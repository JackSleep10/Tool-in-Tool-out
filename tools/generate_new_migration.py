import json
import openpyxl

wb = openpyxl.load_workbook(r'd:\Project Tool in & Tool out\Project Tool in & Tool out (1).xlsx', data_only=True)
ws = wb['Tools']

headers = [ws.cell(1, c).value for c in range(1, 10)]
tools_rows = []

for r in range(2, 708):
    row_vals = []
    for c in range(1, 10):
        v = ws.cell(r, c).value
        if hasattr(v, 'isoformat'):
            v = v.strftime('%Y-%m-%d %H:%M:%S')
        row_vals.append(v)
    if row_vals[0]:
        tools_rows.append(row_vals)

print(f"Loaded {len(tools_rows)} tool rows.")

js_content = f"""/*
 * MIGRATION SCRIPT FOR GSE STORE MANAGEMENT
 * Auto-generated from Project Tool in & Tool out (1).xlsx
 * Total tools: {len(tools_rows)}
 */

const NEW_TOOLS_HEADERS = {json.dumps(headers, ensure_ascii=False)};

const NEW_TOOLS_DATA = {json.dumps(tools_rows, ensure_ascii=False)};

function runToolMigration() {{
  const ss = getSpreadsheet();
  const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
  
  Logger.log("=== STARTING TOOL MIGRATION ===");
  
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
  
  // 2. UPDATE TOOLS SHEET WITH {len(tools_rows)} TOOLS
  Logger.log("Updating 'Tools' sheet with " + NEW_TOOLS_DATA.length + " items...");
  toolsSheet.clearContents();
  
  const toolsAllRows = [NEW_TOOLS_HEADERS].concat(NEW_TOOLS_DATA);
  toolsSheet.getRange(1, 1, toolsAllRows.length, NEW_TOOLS_HEADERS.length).setValues(toolsAllRows);
  Logger.log("Tools sheet updated successfully!");
  
  // 3. SYNC TRANSACTIONS TOOL NAMES IF MISMATCHED
  Logger.log("Verifying Transactions tool names...");
  const txRange = txSheet.getDataRange();
  const txValues = txRange.getValues();
  
  const toolNameMap = {{}};
  for (let t = 0; t < NEW_TOOLS_DATA.length; t++) {{
    const tid = (NEW_TOOLS_DATA[t][0] || '').toString().trim();
    const tname = (NEW_TOOLS_DATA[t][1] || '').toString().trim();
    if (tid) toolNameMap[tid] = tname;
  }}
  
  let txUpdatedCount = 0;
  if (txValues.length > 1) {{
    const txHeaders = txValues[0].map(function(h) {{ return h.toString().toLowerCase().trim(); }});
    const toolIdCol = txHeaders.indexOf('tool_id');
    const toolNameCol = txHeaders.indexOf('tool_name');
    
    if (toolIdCol !== -1 && toolNameCol !== -1) {{
      for (let r = 1; r < txValues.length; r++) {{
        const tid = (txValues[r][toolIdCol] || '').toString().trim();
        if (tid && toolNameMap[tid]) {{
          const expectedName = toolNameMap[tid];
          if (txValues[r][toolNameCol] !== expectedName) {{
            txValues[r][toolNameCol] = expectedName;
            txUpdatedCount++;
          }}
        }}
      }}
      if (txUpdatedCount > 0) {{
        Logger.log("Applying updates to Transactions sheet (" + txUpdatedCount + " rows modified)...");
        txRange.setValues(txValues);
      }}
    }}
  }}
  
  // 4. VERIFY OUTSTANDING BORROWED ITEMS
  const outstanding = [];
  if (txValues.length > 1) {{
    const txHeaders = txValues[0].map(function(h) {{ return h.toString().toLowerCase().trim(); }});
    const toolIdCol = txHeaders.indexOf('tool_id');
    const toolNameCol = txHeaders.indexOf('tool_name');
    const actionCol = txHeaders.indexOf('action');
    const empIdCol = txHeaders.indexOf('employee_id');
    const empNameCol = txHeaders.indexOf('employee_name');
    
    for (let i = 1; i < txValues.length; i++) {{
      const action = (txValues[i][actionCol] || '').toString().toUpperCase().trim();
      const tid = (txValues[i][toolIdCol] || '').toString().trim();
      const tname = (txValues[i][toolNameCol] || '').toString().trim();
      const eid = (txValues[i][empIdCol] || '').toString().trim();
      const ename = (txValues[i][empNameCol] || '').toString().trim();
      
      if (action === 'BORROW') {{
        outstanding.push({{ tid: tid, tname: tname, eid: eid, ename: ename }});
      }} else if (action === 'RETURN') {{
        for (let j = 0; j < outstanding.length; j++) {{
          if (outstanding[j].tid.toLowerCase() === tid.toLowerCase() && 
              outstanding[j].eid.toLowerCase() === eid.toLowerCase()) {{
            outstanding.splice(j, 1);
            break;
          }}
        }}
      }}
    }}
  }}
  
  Logger.log("Total outstanding items currently borrowed: " + outstanding.length);
  for (let k = 0; k < outstanding.length; k++) {{
    Logger.log((k + 1) + ". [" + outstanding[k].tid + "] " + outstanding[k].tname + " | Borrowed by: " + outstanding[k].ename);
  }}
  
  Logger.log("=== MIGRATION COMPLETED SUCCESSFULLY! ===");
  return {{
    status: 'success',
    timestamp: timestamp,
    tools_count: NEW_TOOLS_DATA.length,
    tools_backup: toolsBackupName,
    transactions_backup: txBackupName,
    transactions_name_synced: txUpdatedCount,
    outstanding_count: outstanding.length,
    outstanding_items: outstanding
  }};
}}
"""

with open(r'd:\Project Tool in & Tool out\gas\Migration.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

with open(r'd:\Project Tool in & Tool out\Migration.gs', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Generated gas/Migration.js and Migration.gs successfully.")
