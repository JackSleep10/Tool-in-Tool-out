import json
import openpyxl
import re

with open('./data_backup/current_tools.json', 'r', encoding='utf-8') as f:
    old_tools = json.load(f)

with open('./data_backup/current_transactions.json', 'r', encoding='utf-8') as f:
    current_transactions = json.load(f)

wb = openpyxl.load_workbook('list tool.xlsx')
ws = wb.active
headers = [c.value for c in ws[1]]
new_tools = []
for r in range(2, ws.max_row + 1):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, len(headers) + 1)]
    item = {headers[i]: row_vals[i] for i in range(len(headers))}
    if item.get('id'):
        new_tools.append(item)

old_by_id = {str(t['id']).strip(): t for t in old_tools}
new_by_id = {str(t['id']).strip(): t for t in new_tools}

# Check items 1 to 4
for tid in ['TLR-558', 'TLR-559', 'TLR-560', 'TLR-567', 'TLR-676']:
    o = old_by_id.get(tid, {})
    print(f"Old {tid}: name='{o.get('name')}', loc='{o.get('location')}'")

# Also let's inspect all new tools with location GT2 or GT11 or JMS
print("\nNew tools in GT2:")
for nt in new_tools:
    if 'GT2' in str(nt.get('location', '')) or 'ED-GT2' in str(nt.get('name', '')) or 'AG-GT2' in str(nt.get('name', '')):
        print(f"  [{nt.get('id')}] name='{nt.get('name')}', loc='{nt.get('location')}'")

print("\nNew tools for JUMP STARTER:")
for nt in new_tools:
    if 'JUMP' in str(nt.get('name', '')).upper():
        print(f"  [{nt.get('id')}] name='{nt.get('name')}', loc='{nt.get('location')}'")
