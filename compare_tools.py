import json
import openpyxl
import re

with open('./data_backup/current_tools.json', 'r', encoding='utf-8') as f:
    old_tools = json.load(f)

wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
headers = [c.value for c in ws[1]]
new_tools = []
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    item = {headers[i]: row_vals[i] for i in range(len(headers))}
    if item.get('id'):
        new_tools.append(item)

print(f"Old count: {len(old_tools)}, New count: {len(new_tools)}")

old_by_id = {str(t['id']).strip(): t for t in old_tools}
new_by_id = {str(t['id']).strip(): t for t in new_tools}

# Check TLR-620 to 640
print("\n--- TLR-620 to TLR-640 Comparison ---")
for num in range(620, 641):
    tid = f"TLR-{num}"
    o = old_by_id.get(tid, {}).get('name', '---')
    n = new_by_id.get(tid, {}).get('name', '---')
    print(f"{tid:8} | OLD: {o:40} | NEW: {n}")

# Check TLR-700 to 715
print("\n--- TLR-700 to TLR-715 Comparison ---")
for num in range(700, 716):
    tid = f"TLR-{num}"
    o = old_by_id.get(tid, {}).get('name', '---')
    n = new_by_id.get(tid, {}).get('name', '---')
    print(f"{tid:8} | OLD: {o:40} | NEW: {n}")

# Check TLR-550 to 570
print("\n--- TLR-550 to TLR-570 Comparison ---")
for num in range(550, 571):
    tid = f"TLR-{num}"
    o = old_by_id.get(tid, {}).get('name', '---')
    n = new_by_id.get(tid, {}).get('name', '---')
    print(f"{tid:8} | OLD: {o:40} | NEW: {n}")
