export const MOCK_EMPLOYEES = [
    { id: 'TL001', name: 'Somsak Chaiyaphum', department: 'Maintenance' },
    { id: 'TL002', name: 'Wichai Srivichai', department: 'Towing' },
    { id: 'TL003', name: 'Nadech Kugimiya', department: 'Cleaning' },
    { id: 'TL004', name: 'Yaya Urassaya', department: 'Admin' },
];

export const MOCK_TOOLS = [
    { id: 'T001', name: 'Drill Set (Makita)', location: 'BIN-A1', total_quantity: 2, image_url: '' },
    { id: 'T002', name: 'Wrench 10mm', location: 'BIN-A2', total_quantity: 5, image_url: '' },
    { id: 'T003', name: 'Wrench 12mm', location: 'BIN-A2', total_quantity: 5, image_url: '' },
    { id: 'T004', name: 'Radio (Motorola)', location: 'LOC-Office', total_quantity: 10, image_url: '' },
    { id: 'T005', name: 'Safety Vest (L)', location: 'LOC-Door', total_quantity: 20, image_url: '' },
    { id: 'T006', name: 'Flashlight', location: 'BIN-B1', total_quantity: 8, image_url: '' },
];

export const MOCK_TRANSACTIONS = [
    {
        id: 'tx_001',
        date: '2023-10-25T08:30:00.000Z',
        action: 'BORROW',
        tool_id: 'T001',
        tool_name: 'Drill Set (Makita)',
        employee_id: 'TL001',
        employee_name: 'Somsak Chaiyaphum',
        quantity: 1,
        staff_issuer: 'Admin J',
        staff_receiver: '',
        status: 'PENDING'
    },
    {
        id: 'tx_002',
        date: '2023-10-25T09:00:00.000Z',
        action: 'RETURN',
        tool_id: 'T001',
        tool_name: 'Drill Set (Makita)',
        employee_id: 'TL001',
        employee_name: 'Somsak Chaiyaphum',
        quantity: 1,
        staff_issuer: 'Admin J',
        staff_receiver: 'Admin K',
        status: 'COMPLETED'
    },
    {
        id: 'tx_003',
        date: new Date().toISOString(), // Today
        action: 'BORROW',
        tool_id: 'T004',
        tool_name: 'Radio (Motorola)',
        employee_id: 'TL002',
        employee_name: 'Wichai Srivichai',
        quantity: 1,
        staff_issuer: 'Admin J',
        staff_receiver: '',
        status: 'PENDING'
    }
];
