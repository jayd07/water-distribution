export type Language = 'en' | 'gu';

export interface TranslationsDictionary {
  common: {
    appName: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    deleting: string;
    loading: string;
    search: string;
    searchPlaceholder: string;
    filter: string;
    all: string;
    actions: string;
    date: string;
    notes: string;
    phone: string;
    address: string;
    status: string;
    success: string;
    error: string;
    refresh: string;
    refreshing: string;
    close: string;
    back: string;
    edit: string;
    done: string;
    clearSearch: string;
    showingResults: string;
  };
  nav: {
    dashboard: string;
    customers: string;
    inventory: string;
    deliveries: string;
    driverRun: string;
    recordDelivery: string;
    delivery: string;
    newOrder: string;
    restock: string;
    addCustomer: string;
    switchBusiness: string;
    manageBusiness: string;
    signIn: string;
    logout: string;
    home: string;
    orders: string;
    clients: string;
    more: string;
    account: string;
    dispatch: string;
    deliver: string;
  };
  worker: {
    deliverAction: string;
    deliverNow: string;
    returnAction: string;
    returnEmpty: string;
    emptyJarsCollected: string;
    deliveredQuantity: string;
    jarsDroppedFull: string;
    collectEmptyCans: string;
    bottleBalance: string;
    jarsHeld: string;
    jarsHolding: string;
    pendingDue: string;
    deposit: string;
    collectPayment: string;
    cashCollected: string;
    paymentMode: string;
    paymentCollection: string;
    cash: string;
    upi: string;
    credit: string;
    creditDue: string;
    completeDelivery: string;
    recordSuccess: string;
    startTrip: string;
    completeTrip: string;
    reconcileEndRun: string;
    loadVehicle: string;
    vehicleStock: string;
    vehicleLoaded: string;
    deliveredRemaining: string;
    stopsCompleted: string;
    quickDispatch: string;
    emptyReturn: string;
    route: string;
    callCustomer: string;
    navigate: string;
    fieldDeliveryRun: string;
    liveInTransit: string;
    standby: string;
    logExpense: string;
    schedules: string;
    completedForTrip: string;
    deliverFullCount: string;
    oneTapDeliver: string;
    dueBalance: string;
    totalAmountCollected: string;
    driverStaffName: string;
    itemProductType: string;
    saveDeliveryStock: string;
    saveJarReturn: string;
    returnOnlyBadge: string;
    recordDeliveryTitle: string;
    recordJarReturnTitle: string;
    selectCustomer: string;
    allAreas: string;
    jarsInCirculation: string;
    pendingDuesTotal: string;
  };
  customer: {
    newCustomer: string;
    editCustomer: string;
    customerName: string;
    customerBusinessName: string;
    mobileNumber: string;
    deliveryAddress: string;
    routeArea: string;
    ratePerJar: string;
    openingJarBalance: string;
    jarsCurrentlyHeld: string;
    initialJarsIssued: string;
    openingDue: string;
    customerType: string;
    residential: string;
    commercial: string;
    securityDeposit: string;
    saveCustomer: string;
    createCustomer: string;
    saveChanges: string;
    deleteCustomer: string;
    deleteConfirmTitle: string;
    deleteConfirmText: string;
    customerSaved: string;
    settleBalance: string;
    recordPayment: string;
    totalSettlement: string;
    payeeUpiId: string;
    openInUpiApp: string;
    dueWarning: string;
  };
  pullRefresh: {
    pullToRefresh: string;
    releaseToRefresh: string;
    refreshing: string;
    upToDate: string;
  };
  kpi: {
    todayDispatch: string;
    emptiesReturned: string;
    cashCollected: string;
    cashDrops: string;
    upiPayments: string;
    digitalSettlements: string;
    pendingReceivables: string;
    jarsAcrossAccounts: string;
    jarsHoldingCount: string;
    accountsCount: string;
    jars: string;
    returnRate: string;
  };
}

export const translations: Record<Language, TranslationsDictionary> = {
  en: {
    common: {
      appName: 'AquaPure Springs',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      deleting: 'Deleting...',
      loading: 'Loading...',
      search: 'Search...',
      searchPlaceholder: 'Search customers, routes, or inventory...',
      filter: 'Filter',
      all: 'All',
      actions: 'Actions',
      date: 'Date',
      notes: 'Notes',
      phone: 'Phone',
      address: 'Address',
      status: 'Status',
      success: 'Success',
      error: 'Error',
      refresh: 'Refresh',
      refreshing: 'Refreshing...',
      close: 'Close',
      back: 'Back',
      edit: 'Edit',
      done: 'Done',
      clearSearch: 'Clear search',
      showingResults: 'Showing results filtered by:'
    },
    nav: {
      dashboard: 'Dashboard',
      customers: 'Customers',
      inventory: 'Inventory',
      deliveries: 'Deliveries',
      driverRun: 'Driver Trip',
      recordDelivery: 'Record Delivery',
      delivery: 'Delivery',
      newOrder: 'New Order',
      restock: 'Restock',
      addCustomer: 'Add Customer',
      switchBusiness: 'Switch Business',
      manageBusiness: 'Manage Business',
      signIn: 'Sign In / Manager',
      logout: 'Logout',
      home: 'Home',
      orders: 'Orders',
      clients: 'Customers',
      more: 'More',
      account: 'Account',
      dispatch: 'DISPATCH',
      deliver: 'DELIVER'
    },
    worker: {
      deliverAction: 'Deliver',
      deliverNow: 'Deliver Now',
      returnAction: 'Return',
      returnEmpty: 'Collect Empty',
      emptyJarsCollected: 'Empty Jars Returned',
      deliveredQuantity: 'Delivered Jars',
      jarsDroppedFull: 'Jars Dropped (Full)',
      collectEmptyCans: 'Collect Empty Cans',
      bottleBalance: 'Jar Balance',
      jarsHeld: 'Jars with Customer',
      jarsHolding: 'Holding',
      pendingDue: 'Pending Due',
      deposit: 'Deposit',
      collectPayment: 'Collect Payment',
      cashCollected: 'Cash Collected',
      paymentMode: 'Payment Mode',
      paymentCollection: 'Payment Collection',
      cash: 'Cash',
      upi: 'UPI / Online',
      credit: 'Due / Credit',
      creditDue: 'Due (Credit)',
      completeDelivery: 'Complete Delivery',
      recordSuccess: 'Delivery Recorded!',
      startTrip: 'Start New Delivery Run',
      completeTrip: 'Complete Trip',
      reconcileEndRun: 'Reconcile & End Run',
      loadVehicle: 'Load Vehicle Stock',
      vehicleStock: 'Stock in Vehicle',
      vehicleLoaded: 'Vehicle Loaded',
      deliveredRemaining: 'Delivered / Remaining',
      stopsCompleted: 'Stops Completed',
      quickDispatch: 'Quick Dispatch',
      emptyReturn: 'Empty Return',
      route: 'Delivery Route',
      callCustomer: 'Call',
      navigate: 'Navigate',
      fieldDeliveryRun: 'Field Delivery Run',
      liveInTransit: 'Live In-Transit',
      standby: 'Standby',
      logExpense: 'Log Expense / Fuel',
      schedules: 'Schedules',
      completedForTrip: 'Completed for this Trip',
      deliverFullCount: 'Deliver Full',
      oneTapDeliver: '1-Tap Delivery',
      dueBalance: 'Due Balance',
      totalAmountCollected: 'Total Amount Collected (₹)',
      driverStaffName: 'Driver / Staff Name',
      itemProductType: 'Item / Product Type',
      saveDeliveryStock: 'Save Delivery & Stock',
      saveJarReturn: 'Save Jar Return',
      returnOnlyBadge: '0 (Return Only)',
      recordDeliveryTitle: 'Record Delivery & Stock Movement',
      recordJarReturnTitle: 'Record Jar Return Only',
      selectCustomer: 'Select Customer',
      allAreas: 'All Areas',
      jarsInCirculation: 'jars in circulation',
      pendingDuesTotal: 'pending dues'
    },
    customer: {
      newCustomer: 'Add New Customer',
      editCustomer: 'Edit Customer Profile',
      customerName: 'Customer Name',
      customerBusinessName: 'Customer / Business Name *',
      mobileNumber: 'Phone Number',
      deliveryAddress: 'Full Delivery Address / Flat No.',
      routeArea: 'Delivery Route / Area (Optional)',
      ratePerJar: 'Rate per Jar (₹)',
      openingJarBalance: 'Opening Jar Balance',
      jarsCurrentlyHeld: 'Jars Currently Held',
      initialJarsIssued: 'Initial Jars Issued',
      openingDue: 'Opening Due Balance (₹)',
      customerType: 'Account Type',
      residential: 'Residential (Home)',
      commercial: 'Commercial (Office / Gym)',
      securityDeposit: 'Security Deposit (₹)',
      saveCustomer: 'Save Customer',
      createCustomer: 'Create Customer',
      saveChanges: 'Save Changes',
      deleteCustomer: 'Delete Customer',
      deleteConfirmTitle: 'Delete Customer?',
      deleteConfirmText: 'Are you sure you want to remove this customer?',
      customerSaved: 'Customer saved successfully!',
      settleBalance: 'Settle Payment',
      recordPayment: 'Record Payment',
      totalSettlement: 'Total Settlement',
      payeeUpiId: 'Payee UPI ID',
      openInUpiApp: 'Open in UPI App (Deep Link)',
      dueWarning: 'Customer has pending due amount and jars held.'
    },
    pullRefresh: {
      pullToRefresh: 'Pull down to sync...',
      releaseToRefresh: 'Release to refresh',
      refreshing: 'Syncing Firestore...',
      upToDate: 'Cloud Synced!'
    },
    kpi: {
      todayDispatch: "Today's Dispatch",
      emptiesReturned: 'empties returned',
      cashCollected: 'Cash Collected',
      cashDrops: 'cash drops recorded',
      upiPayments: 'UPI Payments',
      digitalSettlements: 'digital settlements',
      pendingReceivables: 'Pending Receivables',
      jarsAcrossAccounts: 'jars across',
      jarsHoldingCount: 'jars in circulation',
      accountsCount: 'accounts',
      jars: 'jars',
      returnRate: 'return rate',
    }
  },
  gu: {
    common: {
      appName: 'એક્વાપ્યોર સ્પ્રિંગ્સ',
      save: 'સાચવો',
      cancel: 'રદ કરો',
      confirm: 'ખાતરી કરો',
      delete: 'કાઢી નાખો',
      deleting: 'કાઢી રહ્યું છે...',
      loading: 'લોડ થઈ રહ્યું છે...',
      search: 'શોધો...',
      searchPlaceholder: 'ગ્રાહક, રૂટ અથવા સ્ટોક શોધો...',
      filter: 'ફિલ્ટર',
      all: 'બધા',
      actions: 'ક્રિયાઓ',
      date: 'તારીખ',
      notes: 'નોંધ',
      phone: 'ફોન',
      address: 'સરનામું',
      status: 'સ્થિતિ',
      success: 'સફળ',
      error: 'ભૂલ',
      refresh: 'રિફ્રેશ કરો',
      refreshing: 'અપડેટ થાય છે...',
      close: 'બંધ કરો',
      back: 'પાછા જાઓ',
      edit: 'ફેરફાર કરો',
      done: 'પૂર્ણ',
      clearSearch: 'શોધ સાફ કરો',
      showingResults: 'આ શોધ મુજબ પરિણામો:'
    },
    nav: {
      dashboard: 'ડેશબોર્ડ',
      customers: 'ગ્રાહકો',
      inventory: 'ગોડાઉન સ્ટોક',
      deliveries: 'ડિલિવરી લોગ',
      driverRun: 'ડ્રાઈવર ટ્રિપ',
      recordDelivery: 'ડિલિવરી નોંધો',
      delivery: 'ડિલિવરી',
      newOrder: 'નવો ઓર્ડર',
      restock: 'સ્ટોક ઉમેરો',
      addCustomer: 'નવો ગ્રાહક ઉમેરો',
      switchBusiness: 'વેપાર બદલો',
      manageBusiness: 'વેપાર મેનેજ કરો',
      signIn: 'સાઇન ઇન / મેનેજર',
      logout: 'લોગઆઉટ',
      home: 'મુખ્ય પૃષ્ઠ',
      orders: 'ઓર્ડર્સ',
      clients: 'ગ્રાહકો',
      more: 'વધુ વિકલ્પો',
      account: 'ખાતું',
      dispatch: 'ડિસ્પેચ',
      deliver: 'ડિલિવરી'
    },
    worker: {
      deliverAction: 'ડિલિવરી',
      deliverNow: 'હમણાં ડિલિવરી આપો',
      returnAction: 'ખાલી જાર જમા',
      returnEmpty: 'ખાલી જાર લો',
      emptyJarsCollected: 'પરત મળેલ ખાલી જાર',
      deliveredQuantity: 'ડિલિવર કરેલ જાર',
      jarsDroppedFull: 'આપેલ ભરેલી જાર',
      collectEmptyCans: 'ખાલી જાર જમા લો',
      bottleBalance: 'જાર બેલેન્સ',
      jarsHeld: 'ગ્રાહક પાસે જાર',
      jarsHolding: 'પાસે જાર',
      pendingDue: 'બાકી રકમ',
      deposit: 'ડિપોઝિટ',
      collectPayment: 'ચુકવણી મેળવો',
      cashCollected: 'રોકડ સ્વીકારી',
      paymentMode: 'ચુકવણી પદ્ધતિ',
      paymentCollection: 'ચુકવણી પદ્ધતિ પસંદ કરો',
      cash: 'રોકડ (Cash)',
      upi: 'યુપીઆઈ (UPI)',
      credit: 'ઉધાર ખાતું (Credit)',
      creditDue: 'ઉધાર (બાકી)',
      completeDelivery: 'ડિલિવરી પૂર્ણ કરો',
      recordSuccess: 'ડિલિવરી સફળતાપૂર્વક નોંધાઈ!',
      startTrip: 'નવી ડિલિવરી ટ્રિપ શરૂ કરો',
      completeTrip: 'ટ્રિપ પૂર્ણ કરો',
      reconcileEndRun: 'ટ્રિપ પૂર્ણ કરો / હિસાબ મેળવો',
      loadVehicle: 'ગાડીમાં સ્ટોક ભરો',
      vehicleStock: 'ગાડીમાં રહેલ સ્ટોક',
      vehicleLoaded: 'ગાડીમાં ભરેલ જાર',
      deliveredRemaining: 'ડિલિવર / બાકી જાર',
      stopsCompleted: 'પૂર્ણ થયેલ સ્ટોપ',
      quickDispatch: 'ઝડપી ડિસ્પેચ',
      emptyReturn: 'ખાલી જાર રિટર્ન',
      route: 'ડિલિવરી રૂટ',
      callCustomer: 'કોલ કરો',
      navigate: 'નકશો / રસ્તો',
      fieldDeliveryRun: 'ફીલ્ડ ડિલિવરી રન (રૂટ ટ્રિપ)',
      liveInTransit: 'ચાલુ ટ્રિપ (લાઈવ)',
      standby: 'તૈયાર / સ્ટેન્ડબાય',
      logExpense: 'ખર્ચ / ડીઝલ નોંધો',
      schedules: 'ડિલિવરી સમયપત્રક',
      completedForTrip: 'આ ટ્રિપમાં ડિલિવરી પૂર્ણ થઈ',
      deliverFullCount: 'ભરેલી જાર આપો',
      oneTapDeliver: 'એક-ટેપ ડિલિવરી',
      dueBalance: 'બાકી હિસાબ',
      totalAmountCollected: 'કુલ મળેલ રકમ (₹)',
      driverStaffName: 'ડ્રાઈવર / સ્ટાફનું નામ',
      itemProductType: 'પ્રોડક્ટ / પાણી જાર પ્રકાર',
      saveDeliveryStock: 'ડિલિવરી અને સ્ટોક સેવ કરો',
      saveJarReturn: 'માત્ર ખાલી જાર જમા કરો',
      returnOnlyBadge: '૦ (માત્ર રિટર્ન)',
      recordDeliveryTitle: 'ડિલિવરી અને સ્ટોક નોંધણી',
      recordJarReturnTitle: 'માત્ર ખાલી જાર પરત નોંધણી',
      selectCustomer: 'ગ્રાહક પસંદ કરો',
      allAreas: 'બધા વિસ્તારો',
      jarsInCirculation: 'ચાલુ જાર સંખ્યા',
      pendingDuesTotal: 'કુલ બાકી રકમ'
    },
    customer: {
      newCustomer: 'નવો ગ્રાહક ઉમેરો',
      editCustomer: 'ગ્રાહકની માહિતી બદલો',
      customerName: 'ગ્રાહકનું નામ',
      customerBusinessName: 'ગ્રાહક / દુકાનનું નામ *',
      mobileNumber: 'મોબાઇલ નંબર',
      deliveryAddress: 'સંપૂર્ણ સરનામું / ફ્લેટ નં.',
      routeArea: 'ડિલિવરી રૂટ / વિસ્તાર (વૈકલ્પિક)',
      ratePerJar: 'જાર દીઠ ભાવ (₹)',
      openingJarBalance: 'શરૂઆતી જાર બેલેન્સ',
      jarsCurrentlyHeld: 'હાલમાં ગ્રાહક પાસે જાર',
      initialJarsIssued: 'શરૂઆતમાં આપેલ જાર',
      openingDue: 'શરૂઆતી બાકી રકમ (₹)',
      customerType: 'ખાતાનો પ્રકાર',
      residential: 'ઘર / રહેણાંક',
      commercial: 'દુકાન / ઓફિસ (કોમર્શિયલ)',
      securityDeposit: 'સિક્યોરિટી ડિપોઝિટ (₹)',
      saveCustomer: 'ગ્રાહક સેવ કરો',
      createCustomer: 'ગ્રાહક ઉમેરો',
      saveChanges: 'સુધારાઓ સાચવો',
      deleteCustomer: 'ગ્રાહક કાઢી નાખો',
      deleteConfirmTitle: 'ગ્રાહક કાઢી નાખવો છે?',
      deleteConfirmText: 'શું તમે આ ગ્રાહકને લિસ્ટમાંથી દૂર કરવા માંગો છો?',
      customerSaved: 'ગ્રાહક સફળતાપૂર્વક ઉમેરાયો!',
      settleBalance: 'બાકી હિસાબ ચૂકવો',
      recordPayment: 'ચુકવણી નોંધો',
      totalSettlement: 'કુલ જમા રકમ',
      payeeUpiId: 'પેમેન્ટ UPI ID',
      openInUpiApp: 'UPI એપમાં ખોલો (GPay/PhonePe)',
      dueWarning: 'ગ્રાહક પાસે બાકી રકમ અને બોટલો જમા છે.'
    },
    pullRefresh: {
      pullToRefresh: 'રિફ્રેશ કરવા નીચે ખેંચો...',
      releaseToRefresh: 'સિન્ક કરવા છોડી દો',
      refreshing: 'ડેટા ક્લાઉડ સાથે સિન્ક થાય છે...',
      upToDate: 'બધા રેકોર્ડ અપડેટ થઈ ગયા!'
    },
    kpi: {
      todayDispatch: 'આજની ડિલિવરી',
      emptiesReturned: 'ખાલી જાર જમા',
      cashCollected: 'રોકડ આવક',
      cashDrops: 'રોકડ એન્ટ્રી નોંધાયેલ',
      upiPayments: 'યુપીઆઈ પેમેન્ટ',
      digitalSettlements: 'ઓનલાઈન જમા',
      pendingReceivables: 'કુલ બાકી રકમ',
      jarsAcrossAccounts: 'કુલ જાર',
      jarsHoldingCount: 'ગ્રાહકો પાસે જાર',
      accountsCount: 'ખાતાઓ',
      jars: 'જાર',
      returnRate: 'પરત દર',
    }
  }
};
