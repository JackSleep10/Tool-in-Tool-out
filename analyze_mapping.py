import json
import openpyxl

# 1. Load current tools and transactions
with open('./data_backup/current_tools.json', 'r', encoding='utf-8') as f:
    current_tools = json.load(f)

with open('./data_backup/current_transactions.json', 'r', encoding='utf-8') as f:
    current_transactions = json.load(f)

# 2. Load new tools from Excel
wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
new_tools = []
headers = [cell.value for cell in ws[1]]
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    item = {headers[i]: row_vals[i] for i in range(len(headers))}
    if item.get('id'):
        new_tools.append(item)

print(f"Current Tools in Sheet: {len(current_tools)}")
print(f"New Tools in Excel: {len(new_tools)}")
print(f"Current Transactions: {len(current_transactions)}")

# 3. Calculate currently borrowed items (Outstanding)
# Note: In StoreContext.jsx:
# index = currentOutstanding.findIndex(item => item.tool_id === tx.tool_id && item.employee_id === tx.employee_id)
outstanding = []
sorted_txs = sorted(current_transactions, key=lambda x: str(x.get('date', '')))
for tx in sorted_txs:
    action = str(tx.get('action', '')).upper().strip()
    if action == 'BORROW':
        outstanding.append(tx)
    elif action == 'RETURN':
        tid = str(tx.get('tool_id', '')).strip().lower()
        eid = str(tx.get('employee_id', '')).strip().lower()
        for idx, item in enumerate(outstanding):
            if str(item.get('tool_id', '')).strip().lower() == tid and str(item.get('employee_id', '')).strip().lower() == eid:
                outstanding.pop(idx)
                break

print(f"\n--- CURRENTLY BORROWED (OUTSTANDING): {len(outstanding)} ITEMS ---")
for i, item in enumerate(outstanding, 1):
    print(f"{i}. [{item.get('tool_id')}] '{item.get('tool_name')}' | Borrowed by: {item.get('employee_name')} ({item.get('employee_id')}) | Date: {item.get('date')}")

# 4. Check whether these outstanding tool IDs exist in new_tools
new_tool_map = {str(t.get('id', '')).strip().upper(): t for t in new_tools}
new_tool_name_map = {str(t.get('name', '')).strip().upper(): t for t in new_tools}

old_tool_map = {str(t.get('id', '')).strip().upper(): t for t in current_tools}

print("\n--- OUTSTANDING TOOLS VS NEW TOOLS CHECK ---")
for item in outstanding:
    tid = str(item.get('tool_id', '')).strip().upper()
    tname = str(item.get('tool_name', '')).strip()
    
    in_new_by_id = new_tool_map.get(tid)
    in_new_by_name = new_tool_name_map.get(tname.upper())
    
    print(f"Outstanding Item: [{tid}] {tname}")
    if in_new_by_id:
        print(f"  -> Match by ID in new list: [{in_new_by_id.get('id')}] '{in_new_by_id.get('name')}'")
    else:
        print(f"  -> NOT FOUND by ID '{tid}' in new list!")
        if in_new_by_name:
            print(f"  -> But FOUND by Name: New ID is [{in_new_by_name.get('id')}]")
        else:
            print(f"  -> Name '{tname}' also not exact match in new list.")
