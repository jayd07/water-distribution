import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Customer } from '../types';
import { bulkImportCustomers } from '../services/deliveryService';
import { ModalWrapper } from './ui/ModalWrapper';
import { Button } from './ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface ImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  onImportComplete: (message: string, importedCount: number) => void;
}

interface ColumnMapping {
  nameCol: number | '';
  pendingAmountCol: number | '';
  jarsHeldCol: number | '';
  phoneCol: number | '';
  addressCol: number | '';
  routeCol: number | '';
}

interface ParsedRowPreview {
  rowNumber: number; // 1-based Excel/CSV row number
  name: string;
  pendingAmount: number | null;
  jarsHeld: number;
  phone: string;
  address: string;
  route: string;
  errors: string[];
  isValid: boolean;
}

const EMPTY_MAPPING: ColumnMapping = {
  nameCol: '',
  pendingAmountCol: '',
  jarsHeldCol: '',
  phoneCol: '',
  addressCol: '',
  routeCol: '',
};

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\u0A80-\u0AFF]+/g, '')
    .trim();
}

function isNullOrBlankRaw(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return !Number.isFinite(val);
  const str = String(val).trim();
  if (!str) return true;
  const lower = str.toLowerCase();
  return lower === 'null' || lower === 'undefined' || lower === 'nan';
}

function normalizeOptionalString(val: unknown, maxLen: number): string {
  if (isNullOrBlankRaw(val)) return '';
  if (typeof val === 'number') {
    const cleanNum = Math.trunc(val) === val ? Math.trunc(val) : val;
    return String(cleanNum).trim().slice(0, maxLen);
  }
  return String(val).trim().slice(0, maxLen);
}

function normalizeRequiredName(val: unknown): string | null {
  if (isNullOrBlankRaw(val)) return null;
  const str = String(val).trim().slice(0, 128);
  return str.length > 0 ? str : null;
}

function parseRequiredAmount(val: unknown): number | null {
  if (isNullOrBlankRaw(val)) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0) return null;
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }
  const cleaned = String(val)
    .trim()
    .replace(/[₹,\s]/g, '')
    .replace(/^(rs\.?|inr)/i, '')
    .trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function parseOptionalJarsHeld(val: unknown): { value: number; valid: boolean } {
  if (isNullOrBlankRaw(val)) return { value: 0, valid: true };
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0) return { value: 0, valid: false };
    return { value: Math.round(val), valid: true };
  }
  const cleaned = String(val).trim().replace(/[,\s]/g, '');
  if (!cleaned) return { value: 0, valid: true };
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return { value: 0, valid: false };
  return { value: Math.round(num), valid: true };
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  const normalized = headers.map((h) => normalizeHeaderKey(h));

  const findIndex = (exactAliases: string[], partialAliases: string[]): number | '' => {
    for (const alias of exactAliases) {
      const idx = normalized.findIndex((h) => h === alias);
      if (idx !== -1) return idx;
    }
    for (const alias of partialAliases) {
      const idx = normalized.findIndex((h) => h.includes(alias));
      if (idx !== -1) return idx;
    }
    return '';
  };

  mapping.nameCol = findIndex(
    ['name', 'customername', 'clientname', 'fullname', 'partyname', 'customer', 'ગ્રાહકનુંનામ', 'નામ'],
    ['name', 'customer', 'client', 'party', 'નામ']
  );

  mapping.pendingAmountCol = findIndex(
    ['pendingamount', 'pendingamt', 'pending', 'dueamount', 'due', 'balance', 'pendingbalance', 'outstanding', 'બાકીરકમ', 'બાકી'],
    ['pending', 'due', 'balance', 'outstanding', 'amount', 'બાકી']
  );

  mapping.jarsHeldCol = findIndex(
    ['jarsheld', 'jarsholding', 'jars', 'bottles', 'cans', 'holding', 'jarcount', 'જાર'],
    ['jar', 'bottle', 'can', 'holding', 'જાર']
  );

  mapping.phoneCol = findIndex(
    ['phonenumber', 'phone', 'mobilenumber', 'mobile', 'contactnumber', 'contact', 'tel', 'મોબાઇલનંબર', 'મોબાઇલ', 'ફોન'],
    ['phone', 'mobile', 'contact', 'tel', 'whatsapp', 'મોબાઇલ', 'ફોન']
  );

  mapping.addressCol = findIndex(
    ['address', 'deliveryaddress', 'location', 'area', 'venue', 'સરનામું'],
    ['address', 'location', 'street', 'flat', 'સરનામું']
  );

  mapping.routeCol = findIndex(
    ['route', 'routearea', 'deliveryroute', 'zone', 'રૂટ'],
    ['route', 'zone', 'રૂટ']
  );

  return mapping;
}

export const ImportCustomersModal: React.FC<ImportCustomersModalProps> = ({
  isOpen,
  onClose,
  businessId,
  onImportComplete,
}) => {
  const { isGujarati } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<{ rowNumber: number; cells: unknown[] }[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetModalState = () => {
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setMapping(EMPTY_MAPPING);
    setParseError(null);
    setIsDragging(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!isOpen) {
      resetModalState();
    }
  }, [isOpen]);

  const handleFileProcess = async (file: File) => {
    setParseError(null);
    // Clear previous sheet state completely before parsing new file to prevent any stale data
    setHeaders([]);
    setRawRows([]);
    setMapping(EMPTY_MAPPING);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setParseError(
        isGujarati
          ? 'કૃપા કરીને માત્ર .csv, .xlsx અથવા .xls ફાઇલ અપલોડ કરો.'
          : 'Please upload a valid .csv, .xlsx, or .xls file.'
      );
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', raw: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setParseError(isGujarati ? 'આ ફાઇલમાં કોઈ શીટ મળી નથી.' : 'No worksheet found inside this file.');
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: null,
        raw: true,
      });

      // Find the first row that contains at least one non-empty header cell
      const headerRowIdx = matrix.findIndex(
        (row) => Array.isArray(row) && row.some((cell) => !isNullOrBlankRaw(cell))
      );

      if (headerRowIdx === -1) {
        setParseError(
          isGujarati
            ? 'અપલોડ કરેલી ફાઇલ ખાલી છે. કૃપા કરીને ગ્રાહકની વિગતો સાથેની ફાઇલ પસંદ કરો.'
            : 'The uploaded file appears empty. Please select a file with customer rows.'
        );
        return;
      }

      const headerRow = matrix[headerRowIdx] || [];
      const maxCols = Math.max(
        headerRow.length,
        ...matrix.slice(headerRowIdx + 1).map((r) => (Array.isArray(r) ? r.length : 0))
      );

      const parsedHeaders = Array.from({ length: maxCols }, (_, idx) => {
        const rawCell = headerRow[idx];
        return isNullOrBlankRaw(rawCell) ? `Column ${idx + 1}` : String(rawCell).trim();
      });

      const parsedDataRows: { rowNumber: number; cells: unknown[] }[] = [];
      for (let i = headerRowIdx + 1; i < matrix.length; i++) {
        const rowCells = Array.isArray(matrix[i]) ? matrix[i] : [];
        const hasAnyValue = rowCells.some((cell) => !isNullOrBlankRaw(cell));
        if (hasAnyValue) {
          parsedDataRows.push({
            rowNumber: i + 1,
            cells: rowCells,
          });
        }
      }

      if (parsedDataRows.length === 0) {
        setParseError(
          isGujarati
            ? 'હેડર નીચે કોઈ ગ્રાહક ડેટા રો મળી નથી.'
            : 'No customer data rows were found below the header row.'
        );
        return;
      }

      setFileName(file.name);
      setHeaders(parsedHeaders);
      setRawRows(parsedDataRows);
      setMapping(autoDetectMapping(parsedHeaders));
    } catch {
      setParseError(
        isGujarati
          ? 'ફાઇલ વાંચવામાં નિષ્ફળ. કૃપા કરીને ચકાસો કે CSV અથવા Excel ફાઇલ યોગ્ય ફોર્મેટમાં છે.'
          : 'Failed to read file. Please verify the CSV or Excel file is not corrupted.'
      );
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so re-uploading the same file works cleanly
    e.target.value = '';
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleRows = [
      {
        Name: 'Rameshbhai Patel',
        'Pending Amount': 450,
        'Jars Held': 3,
        'Phone Number': '9876543210',
        Address: 'B-204, Shanti Residency, Ring Road',
      },
      {
        Name: 'Suresh Dairy & Sweets',
        'Pending Amount': 0,
        'Jars Held': 5,
        'Phone Number': '',
        Address: '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    if (format === 'csv') {
      XLSX.writeFile(workbook, 'customers_import_template.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, 'customers_import_template.xlsx');
    }
  };

  const isRequiredMappingComplete =
    mapping.nameCol !== '' && mapping.pendingAmountCol !== '';

  const previewRows: ParsedRowPreview[] = useMemo(() => {
    if (rawRows.length === 0 || !isRequiredMappingComplete) return [];

    return rawRows.map((row) => {
      const errors: string[] = [];
      const rawName = mapping.nameCol !== '' ? row.cells[mapping.nameCol] : null;
      const rawPending = mapping.pendingAmountCol !== '' ? row.cells[mapping.pendingAmountCol] : null;
      const rawJars = mapping.jarsHeldCol !== '' ? row.cells[mapping.jarsHeldCol] : null;
      const rawPhone = mapping.phoneCol !== '' ? row.cells[mapping.phoneCol] : null;
      const rawAddress = mapping.addressCol !== '' ? row.cells[mapping.addressCol] : null;
      const rawRoute = mapping.routeCol !== '' ? row.cells[mapping.routeCol] : null;

      const parsedName = normalizeRequiredName(rawName);
      if (!parsedName) {
        errors.push(isGujarati ? 'નામ ખાલી છે' : 'Name is blank');
      }

      const parsedPending = parseRequiredAmount(rawPending);
      if (parsedPending === null) {
        errors.push(
          isGujarati
            ? 'બાકી રકમ ખાલી અથવા અમાન્ય છે'
            : 'Pending amount is blank or invalid'
        );
      }

      const parsedJars = parseOptionalJarsHeld(rawJars);
      if (!parsedJars.valid) {
        errors.push(
          isGujarati ? 'જારની સંખ્યા અમાન્ય છે' : 'Jars held must be a valid number'
        );
      }

      // Explicitly normalize null/blank optional fields to "" (never carry over stale data)
      const phone = normalizeOptionalString(rawPhone, 20);
      const address = normalizeOptionalString(rawAddress, 256);
      const route = normalizeOptionalString(rawRoute, 64);

      return {
        rowNumber: row.rowNumber,
        name: parsedName || '',
        pendingAmount: parsedPending,
        jarsHeld: parsedJars.value,
        phone,
        address,
        route,
        errors,
        isValid: errors.length === 0,
      };
    });
  }, [rawRows, mapping, isRequiredMappingComplete, isGujarati]);

  const validRows = useMemo(
    () => previewRows.filter((r) => r.isValid && r.pendingAmount !== null),
    [previewRows]
  );
  const invalidRows = useMemo(
    () => previewRows.filter((r) => !r.isValid),
    [previewRows]
  );

  const handleConfirmImport = async () => {
    if (!businessId || businessId === 'AquaPure_Springs') {
      setParseError(
        isGujarati
          ? 'કૃપા કરીને પહેલા તમારો સક્રિય બિઝનેસ પસંદ કરો અથવા રજીસ્ટર કરો.'
          : 'Please register or select an active business first before importing customers.'
      );
      return;
    }

    if (validRows.length === 0) {
      setParseError(
        isGujarati
          ? 'આયાત કરવા માટે કોઈ માન્ય ગ્રાહક રો મળી નથી.'
          : 'No valid customer rows found to import.'
      );
      return;
    }

    setIsImporting(true);
    setParseError(null);

    try {
      const payload: Array<Omit<Customer, 'id' | 'createdAt'>> = validRows.map((row) => ({
        name: row.name,
        phone: row.phone, // "" when blank/null
        address: row.address, // "" when blank/null
        customerType: 'RESIDENTIAL',
        jarsHolding: row.jarsHeld,
        dueAmount: row.pendingAmount ?? 0,
        depositPaid: 0,
        route: row.route, // "" when blank/null
      }));

      const result = await bulkImportCustomers(businessId, payload);
      triggerHaptic('order');

      const importedCount = result.created.length;
      const skippedCount = invalidRows.length;
      const msg = isGujarati
        ? `${importedCount} ગ્રાહકો સફળતાપૂર્વક ઉમેરાયા${skippedCount > 0 ? ` (${skippedCount} અમાન્ય રો છોડી)` : ''}`
        : `Imported ${importedCount} customer${importedCount === 1 ? '' : 's'} successfully${
            skippedCount > 0 ? ` (${skippedCount} invalid row${skippedCount === 1 ? '' : 's'} skipped)` : ''
          }`;

      onImportComplete(msg, importedCount);
      onClose();
    } catch {
      setParseError(
        isGujarati
          ? 'ગ્રાહકો આયાત કરવામાં નિષ્ફળ. કૃપા કરીને ફરી પ્રયાસ કરો.'
          : 'Failed to import customers. Please try again.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      icon={
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
      }
      title={isGujarati ? 'CSV / Excel દ્વારા ગ્રાહકો ઉમેરો' : 'Import Customers from CSV / Excel'}
      subtitle={
        isGujarati
          ? 'નામ અને બાકી રકમ ફરજિયાત છે • ફોન નંબર અને સરનામું ખાલી રાખી શકાય છે'
          : 'Name & Pending Amount are required • Phone & Address can be blank'
      }
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            {rawRows.length > 0 && isRequiredMappingComplete && (
              <span>
                {isGujarati
                  ? `${validRows.length} માન્ય • ${invalidRows.length} ભૂલવાળી રો`
                  : `${validRows.length} valid • ${invalidRows.length} skipped`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isImporting}>
              {isGujarati ? 'રદ કરો' : 'Cancel'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              glow
              id="confirm-import-customers-btn"
              disabled={!isRequiredMappingComplete || validRows.length === 0 || isImporting}
              isLoading={isImporting}
              onClick={handleConfirmImport}
              leftIcon={<Check className="w-4 h-4 stroke-[2.5]" />}
            >
              {isGujarati
                ? `${validRows.length} ગ્રાહકો ઉમેરો`
                : `Import ${validRows.length} Customer${validRows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          id="customer-import-file-input"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Template & Upload Info Bar */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-800">
              {isGujarati ? 'શીટ કોલમ માર્ગદર્શિકા' : 'Sheet Format Guidelines'}
            </p>
            <p className="text-[11px] text-slate-500">
              {isGujarati
                ? 'ફરજિયાત: નામ, બાકી રકમ • વૈકલ્પિક (ખાલી ચાલશે): જાર, ફોન નંબર, સરનામું'
                : 'Required: Name, Pending Amount • Optional (nullable): Jars Held, Phone Number, Address'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleDownloadTemplate('csv')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadTemplate('xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {parseError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-medium leading-relaxed">{parseError}</span>
          </div>
        )}

        {/* File Upload Dropzone */}
        {!fileName ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-sky-500 bg-sky-50/70'
                : 'border-slate-300 hover:border-sky-400 bg-slate-50/50 hover:bg-sky-50/30'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              {isGujarati
                ? 'CSV અથવા Excel ફાઇલ અહીં ખેંચો અથવા ક્લિક કરો'
                : 'Click to browse or drag & drop CSV / Excel sheet'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {isGujarati
                ? '.csv, .xlsx, .xls ફાઇલો સપોર્ટેડ છે'
                : 'Supports .csv, .xlsx, and .xls files'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Uploaded File Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{fileName}</p>
                  <p className="text-[11px] text-slate-600">
                    {rawRows.length} {isGujarati ? 'ડેટા રો મળી' : 'data rows detected'} • {headers.length}{' '}
                    {isGujarati ? 'કોલમ' : 'columns'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetModalState();
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{isGujarati ? 'ફાઇલ બદલો' : 'Change File'}</span>
              </button>
            </div>

            {/* Column Mapping Grid */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <h4 className="font-bold text-slate-800 text-xs">
                {isGujarati ? 'કોલમ મેપિંગ ચકાસો' : 'Verify Column Mapping'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isGujarati ? 'ગ્રાહકનું નામ *' : 'Customer Name *'}
                  </label>
                  <select
                    value={mapping.nameCol}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        nameCol: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      mapping.nameCol === '' ? 'border-rose-300 text-rose-700' : 'border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="">{isGujarati ? '-- કોલમ પસંદ કરો --' : '-- Select column --'}</option>
                    {headers.map((h, i) => (
                      <option key={`name-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isGujarati ? 'બાકી રકમ (₹) *' : 'Pending Amount (₹) *'}
                  </label>
                  <select
                    value={mapping.pendingAmountCol}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        pendingAmountCol: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      mapping.pendingAmountCol === ''
                        ? 'border-rose-300 text-rose-700'
                        : 'border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="">{isGujarati ? '-- કોલમ પસંદ કરો --' : '-- Select column --'}</option>
                    {headers.map((h, i) => (
                      <option key={`due-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isGujarati ? 'પાસે જાર (Jars Held)' : 'Jars Held'}
                  </label>
                  <select
                    value={mapping.jarsHeldCol}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        jarsHeldCol: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">{isGujarati ? '(૦ રાખો / કોઈ નહીં)' : '(Default 0 / None)'}</option>
                    {headers.map((h, i) => (
                      <option key={`jars-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isGujarati ? 'ફોન નંબર (ખાલી ચાલશે)' : 'Phone Number (Nullable)'}
                  </label>
                  <select
                    value={mapping.phoneCol}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        phoneCol: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">{isGujarati ? '(ખાલી રાખો / કોઈ નહીં)' : '(Keep Blank / None)'}</option>
                    {headers.map((h, i) => (
                      <option key={`phone-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isGujarati ? 'સરનામું (ખાલી ચાલશે)' : 'Address (Nullable)'}
                  </label>
                  <select
                    value={mapping.addressCol}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        addressCol: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">{isGujarati ? '(ખાલી રાખો / કોઈ નહીં)' : '(Keep Blank / None)'}</option>
                    {headers.map((h, i) => (
                      <option key={`addr-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isGujarati ? 'રૂટ / વિસ્તાર (વૈકલ્પિક)' : 'Route / Area (Optional)'}
                  </label>
                  <select
                    value={mapping.routeCol}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        routeCol: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">{isGujarati ? '(ખાલી રાખો / કોઈ નહીં)' : '(Keep Blank / None)'}</option>
                    {headers.map((h, i) => (
                      <option key={`route-${i}`} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {!isRequiredMappingComplete ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  {isGujarati
                    ? 'આગળ વધવા માટે કૃપા કરીને "ગ્રાહકનું નામ" અને "બાકી રકમ" બંને કોલમ પસંદ કરો.'
                    : 'Please map both "Customer Name" and "Pending Amount" columns to preview and import.'}
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Validation Summary Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {validRows.length} {isGujarati ? 'આયાત માટે તૈયાર' : 'Ready to Import'}
                    </span>
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        {invalidRows.length}{' '}
                        {isGujarati
                          ? 'અમાન્ય (છોડી દેવાશે)'
                          : 'Invalid (Will be skipped)'}
                      </span>
                    </span>
                  )}
                </div>

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5">#</th>
                          <th className="py-2 px-2.5">{isGujarati ? 'નામ' : 'Name'}</th>
                          <th className="py-2 px-2.5 text-right">{isGujarati ? 'બાકી (₹)' : 'Pending (₹)'}</th>
                          <th className="py-2 px-2.5 text-right">{isGujarati ? 'જાર' : 'Jars'}</th>
                          <th className="py-2 px-2.5">{isGujarati ? 'ફોન' : 'Phone'}</th>
                          <th className="py-2 px-2.5">{isGujarati ? 'સરનામું' : 'Address'}</th>
                          <th className="py-2 px-2.5">{isGujarati ? 'સ્થિતિ' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {previewRows.slice(0, 100).map((row) => (
                          <tr
                            key={`preview-${row.rowNumber}`}
                            className={row.isValid ? 'hover:bg-slate-50/70' : 'bg-rose-50/60'}
                          >
                            <td className="py-1.5 px-2.5 font-mono text-slate-400">{row.rowNumber}</td>
                            <td className="py-1.5 px-2.5 font-semibold text-slate-900 max-w-[140px] truncate">
                              {row.name || (
                                <span className="text-rose-600 italic">
                                  {isGujarati ? '(ખાલી)' : '(blank)'}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">
                              {row.pendingAmount !== null ? (
                                `₹${row.pendingAmount.toLocaleString('en-IN')}`
                              ) : (
                                <span className="text-rose-600 italic">
                                  {isGujarati ? '(ખાલી)' : '(blank)'}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono text-sky-700 font-semibold">
                              {row.jarsHeld}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-slate-600 max-w-[110px] truncate">
                              {row.phone || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-1.5 px-2.5 text-slate-600 max-w-[150px] truncate">
                              {row.address || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                              {row.isValid ? (
                                <span className="text-emerald-700 font-semibold">
                                  {isGujarati ? 'તૈયાર' : 'Ready'}
                                </span>
                              ) : (
                                <span className="text-rose-700 font-semibold">
                                  {row.errors.join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewRows.length > 100 && (
                    <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-center">
                      {isGujarati
                        ? `પ્રથમ ૧૦૦ રો બતાવેલ છે (કુલ ${previewRows.length} રો)`
                        : `Showing first 100 of ${previewRows.length} rows`}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};
