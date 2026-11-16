import json
import openpyxl

# Load data
with open('./data_backup/full_tool_mapping.json', 'r', encoding='utf-8') as f:
    full_mapping = json.load(f)

wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
headers = [c.value for c in ws[1]]
new_tools_rows = []
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    # Ensure id is string
    if row_vals[0]:
        new_tools_rows.append(row_vals)

print(f"Total new tools rows: {len(new_tools_rows)}")
print(f"Total mapping items: {len(full_mapping)}")

# Convert mapping into a compact lookup: old_id -> [new_id, new_name]
compact_mapping = {}
for k, v in full_mapping.items():
    compact_mapping[k] = [v['new_id'], v['new_name']]

# Generate migration.gs
gs_content = """/*
 * MIGRATION SCRIPT FOR GSE STORE MANAGEMENT
 * 
 * Instructions:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1I71IPC0Sb-PI9zNIcxsJ4ifVqggHXU3xeE2Of6Q4OXc
 * 2. Click: Extensions (ส่วนขยาย) -> Apps Script
 * 3. Create a new file named 'Migration.gs' (or paste at the bottom of Code.gs)
 * 4. In the toolbar, select function 'runToolMigration' and click 'Run' (เรียกใช้)
 * 5. Check the Execution Log (บันทึกการดำเนินการ) to verify the results!
 */

const NEW_TOOLS_HEADERS = """ + json.dumps(headers, ensure_ascii=False) + """;

const NEW_TOOLS_DATA = """ + json.dumps(new_tools_rows, ensure_ascii=False) + """;

const TOOL_MAPPING = """ + json.dumps(compact_mapping, ensure_ascii=False) + """;

function runToolMigration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
  
  Logger.log("=== STARTING TOOL & TRANSACTION MIGRATION ===");
  
  // 1. BACKUP CURRENT SHEETS
  const toolsSheet = ss.getSheetByName('Tools');
  const txSheet = ss.getSheetByName('Transactions');
  
  if (!toolsSheet) throw new Error("Sheet 'Tools' not found!");
  if (!txSheet) throw new Error("Sheet 'Transactions' not found!");
  
  const toolsBackupName = 'Tools_Backup_' + timestamp;
  const txBackupName = 'Transactions_Backup_' + timestamp;
  
  Logger.log("Creating backup: " + toolsBackupName);
  toolsSheet.copyTo(ss).setName(toolsBackupName);
  
  Logger.log("Creating backup: " + txBackupName);
  txSheet.copyTo(ss).setName(txBackupName);
  
  // 2. UPDATE TOOLS SHEET WITH NEW 706 TOOLS
  Logger.log("Updating 'Tools' sheet with " + NEW_TOOLS_DATA.length + " items...");
  toolsSheet.clearContents();
  
  const toolsAllRows = [NEW_TOOLS_HEADERS].concat(NEW_TOOLS_DATA);
  toolsSheet.getRange(1, 1, toolsAllRows.length, NEW_TOOLS_HEADERS.length).setValues(toolsAllRows);
  Logger.log("Tools sheet updated successfully!");
  
  // 3. UPDATE TRANSACTIONS SHEET
  Logger.log("Reading Transactions sheet...");
  const txRange = txSheet.getDataRange();
  const txValues = txRange.getValues();
  
  if (txValues.length <= 1) {
    Logger.log("No transactions to update.");
    return;
  }
  
  const txHeaders = txValues[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  const toolIdCol = txHeaders.indexOf('tool_id');
  const toolNameCol = txHeaders.indexOf('tool_name');
  
  if (toolIdCol === -1 || toolNameCol === -1) {
    throw new Error("Could not find 'tool_id' or 'tool_name' columns in Transactions!");
  }
  
  let updatedCount = 0;
  for (let r = 1; r < txValues.length; r++) {
    const rawId = (txValues[r][toolIdCol] || '').toString().trim();
    if (rawId && TOOL_MAPPING[rawId]) {
      const target = TOOL_MAPPING[rawId];
      txValues[r][toolIdCol] = target[0];
      txValues[r][toolNameCol] = target[1];
      updatedCount++;
    }
  }
  
  Logger.log("Applying updates to Transactions sheet (" + updatedCount + " rows modified)...");
  txRange.setValues(txValues);
  Logger.log("Transactions sheet updated successfully!");
  
  // 4. VERIFY OUTSTANDING BORROWED ITEMS
  Logger.log("--- VERIFYING OUTSTANDING ITEMS ---");
  const outstanding = [];
  for (let i = 1; i < txValues.length; i++) {
    const action = (txValues[i][txHeaders.indexOf('action')] || '').toString().toUpperCase().trim();
    const tid = (txValues[i][toolIdCol] || '').toString().trim();
    const tname = (txValues[i][toolNameCol] || '').toString().trim();
    const eid = (txValues[i][txHeaders.indexOf('employee_id')] || '').toString().trim();
    const ename = (txValues[i][txHeaders.indexOf('employee_name')] || '').toString().trim();
    
    if (action === 'BORROW') {
      outstanding.push({ tid: tid, tname: tname, eid: eid, ename: ename });
    } else if (action === 'RETURN') {
      for (let j = 0; j < outstanding.length; j++) {
        if (outstanding[j].tid.toLowerCase() === tid.toLowerCase() && 
            outstanding[j].eid.toLowerCase() === eid.toLowerCase()) {
          outstanding.splice(j, 1);
          break;
        }
      }
    }
  }
  
  Logger.log("Total outstanding items currently borrowed: " + outstanding.length);
  for (let k = 0; k < outstanding.length; k++) {
    Logger.log((k + 1) + ". [" + outstanding[k].tid + "] " + outstanding[k].tname + " | Borrowed by: " + outstanding[k].ename);
  }
  
  Logger.log("=== MIGRATION COMPLETED SUCCESSFULLY! ===");
}
"""

with open('Migration.gs', 'w', encoding='utf-8') as f:
    f.write(gs_content)

print("Created Migration.gs successfully.")
