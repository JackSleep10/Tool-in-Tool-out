import json

with open('./data_backup/current_transactions.json', 'r', encoding='utf-8') as f:
    txs = json.load(f)

with open('./data_backup/full_tool_mapping.json', 'r', encoding='utf-8') as f:
    mapping = json.load(f)

# Replay with mapped values
sorted_txs = sorted(txs, key=lambda x: str(x.get('date', '')))
outstanding = []
for tx in sorted_txs:
    tid = str(tx.get('tool_id', '')).strip()
    m = mapping.get(tid)
    mapped_tid = m['new_id'] if m else tid
    mapped_tname = m['new_name'] if m else tx.get('tool_name')
    
    action = str(tx.get('action', '')).upper().strip()
    if action == 'BORROW':
        outstanding.append({**tx, 'tool_id': mapped_tid, 'tool_name': mapped_tname})
    elif action == 'RETURN':
        eid = str(tx.get('employee_id', '')).strip().lower()
        for idx, item in enumerate(outstanding):
            if str(item.get('tool_id', '')).strip().lower() == str(mapped_tid).strip().lower() and \
               str(item.get('employee_id', '')).strip().lower() == eid:
                outstanding.pop(idx)
                break

print(f"Total outstanding after mapped replay: {len(outstanding)}")
for i, item in enumerate(outstanding, 1):
    print(f"{i:2d}. [{item.get('tool_id'):8}] {item.get('tool_name'):45} | Emp: {item.get('employee_name')} ({item.get('employee_id')})")
