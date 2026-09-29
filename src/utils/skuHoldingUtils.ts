import { Customer, DeliveryLog, InventoryItem } from '../types';

export interface SkuHoldingItem {
  itemType: string;
  displayName: string;
  count: number;
  unitPrice: number;
  depositAmount: number;
}

/**
 * Resolves the SKU-wise breakdown of jars held by a customer.
 * Uses customer.jarsHoldingBySku if populated, or accurately reconstructs it
 * from the customer's delivery history across all SKUs.
 */
export function getCustomerSkuHoldings(
  customer?: Customer | null,
  deliveries?: DeliveryLog[] | null,
  inventory?: InventoryItem[] | null
): SkuHoldingItem[] {
  if (!customer) return [];

  const inventoryList = inventory && inventory.length > 0 ? inventory : [];
  const defaultSku = inventoryList[0]?.itemType || '20L Normal Jar';

  const skuMap: Record<string, number> = {};

  // Case 1: If customer has explicit jarsHoldingBySku mapping
  if (customer.jarsHoldingBySku && Object.keys(customer.jarsHoldingBySku).length > 0) {
    for (const [sku, count] of Object.entries(customer.jarsHoldingBySku)) {
      if (Number(count) > 0) {
        skuMap[sku] = Number(count);
      }
    }
  } 
  // Case 2: Reconstruct from customer's historical deliveries
  else if (deliveries && deliveries.length > 0) {
    const custDeliveries = deliveries.filter(d => d.customerId === customer.id);
    if (custDeliveries.length > 0) {
      // Sort oldest to newest
      const sorted = [...custDeliveries].sort((a, b) => a.timestamp - b.timestamp);
      for (const d of sorted) {
        const itemType = d.itemType || defaultSku;
        const currentCount = skuMap[itemType] || 0;
        const newCount = Math.max(0, currentCount + (Number(d.jarsDelivered) || 0) - (Number(d.emptyJarsCollected) || 0));
        skuMap[itemType] = newCount;
      }
    }
  }

  // Calculate sum of reconciled SKUs
  const calculatedSum = Object.values(skuMap).reduce((sum, c) => sum + (c || 0), 0);
  const totalReportedHolding = Number(customer.jarsHolding) || 0;

  // If customer has recorded jarsHolding but skuMap doesn't account for all of them,
  // allocate remaining jars to the default active inventory SKU
  if (totalReportedHolding > calculatedSum) {
    const remainder = totalReportedHolding - calculatedSum;
    skuMap[defaultSku] = (skuMap[defaultSku] || 0) + remainder;
  }

  // Convert to formatted list with pricing & metadata
  const results: SkuHoldingItem[] = [];

  for (const [itemType, count] of Object.entries(skuMap)) {
    if (count > 0) {
      const matchedInv = inventoryList.find(i => i.itemType === itemType || i.displayName === itemType);
      results.push({
        itemType,
        displayName: matchedInv?.displayName || itemType,
        count,
        unitPrice: Number(matchedInv?.unitPrice) || 35,
        depositAmount: Number(matchedInv?.depositAmount) || 150
      });
    }
  }

  // If customer holds jars but no specific SKU was found, fallback cleanly
  if (results.length === 0 && totalReportedHolding > 0) {
    const matchedInv = inventoryList[0];
    results.push({
      itemType: defaultSku,
      displayName: matchedInv?.displayName || defaultSku,
      count: totalReportedHolding,
      unitPrice: Number(matchedInv?.unitPrice) || 35,
      depositAmount: Number(matchedInv?.depositAmount) || 150
    });
  }

  return results;
}

/**
 * Format SKU-wise jar holdings into a clean text block for WhatsApp and SMS sharing.
 */
export function formatSkuHoldingsForWhatsApp(holdings: SkuHoldingItem[]): string {
  if (!holdings || holdings.length === 0) {
    return `*Water Jars with Customer:* 0 bottle(s)\n`;
  }

  const totalJars = holdings.reduce((sum, h) => sum + h.count, 0);

  if (holdings.length === 1) {
    return `*Water Jars Held:* ${totalJars} bottle(s) (${holdings[0].displayName})\n`;
  }

  let text = `*Water Jars Held (SKU Breakdown):*\n`;
  for (const h of holdings) {
    text += `  • ${h.displayName}: ${h.count} bottle(s)\n`;
  }
  text += `*Total Bottles in Possession:* ${totalJars} bottle(s)\n`;
  return text;
}
