import { db } from './index.ts';
import { inventoryLedger, auditLogs } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getLedgerState(key: string = 'shared_ledger') {
  try {
    const records = await db.select().from(inventoryLedger).where(eq(inventoryLedger.key, key)).limit(1);
    if (records.length === 0) {
      return null;
    }
    return records[0];
  } catch (error) {
    console.error('Failed to get ledger state:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function saveLedgerState(
  key: string = 'shared_ledger',
  inv: string,
  startDate: string,
  cutDate: string,
  stateData: Record<string, unknown>,
  updatedBy?: string
) {
  try {
    const result = await db.insert(inventoryLedger)
      .values({
        key,
        inv,
        startDate,
        cutDate,
        stateData,
        updatedAt: new Date(),
        updatedBy: updatedBy || 'system',
      })
      .onConflictDoUpdate({
        target: inventoryLedger.key,
        set: {
          inv,
          startDate,
          cutDate,
          stateData,
          updatedAt: new Date(),
          updatedBy: updatedBy || 'system',
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to save ledger state:', error);
    throw new Error('Database update failed. Please try again later.', { cause: error });
  }
}

export async function addAuditLog(
  timestamp: string,
  username: string,
  tab: string,
  action: string,
  description: string,
  date?: string,
  location?: string
) {
  try {
    const result = await db.insert(auditLogs)
      .values({
        timestamp,
        username,
        tab,
        action,
        description,
        date: date || null,
        location: location || null,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to add audit log:', error);
    throw new Error('Failed to record audit log.', { cause: error });
  }
}

export async function getRecentAuditLogs(limitCount: number = 50) {
  try {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(limitCount);
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    throw new Error('Failed to retrieve audit logs.', { cause: error });
  }
}
