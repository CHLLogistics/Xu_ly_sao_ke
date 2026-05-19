export const parseAmount = val => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.toString().replace(/,/g, '').trim()) || 0;
};

export const BankParsers = {
    BIDV: {
        detect: (rows, localAppData) => {
            for (let i = 0; i < Math.min(30, rows.length); i++) {
                const rowStr = (rows[i] || []).join(' ').toUpperCase();
                let bankIdFound = Object.keys(localAppData.MASTER).find(k => rowStr.includes(k) && localAppData.MASTER[k].bank === 'BIDV');
                if (bankIdFound || rowStr.includes('8600098886') || rowStr.includes('BIDV')) {
                    let bankId = bankIdFound || "8600098886";
                    let startRow = 13;
                    let colDate = 2, colDebit = 3, colCredit = 4, colDesc = 8;
                    for (let r = Math.max(0, i); r <= Math.min(rows.length-1, i + 15); r++) {
                        if (rows[r]) {
                            let rUpper = rows[r].map(c => (c || '').toString().toUpperCase());
                            let dateIdx = rUpper.findIndex(c => c.includes('NGÀY GD') || c.includes('NGÀY CTHU') || c.includes('GIAO DỊCH'));
                            let debitIdx = rUpper.findIndex(c => c.includes('SỐ TIỀN GHI NỢ'));
                            let creditIdx = rUpper.findIndex(c => c.includes('SỐ TIỀN GHI CÓ'));
                            let descIdx = rUpper.findIndex(c => c.includes('DIỄN GIẢI') || c.includes('NỘI DUNG'));
                            if (dateIdx !== -1 && descIdx !== -1) {
                                startRow = r + 1;
                                colDate = dateIdx; colDebit = debitIdx !== -1 ? debitIdx : 3; colCredit = creditIdx !== -1 ? creditIdx : 4; colDesc = descIdx;
                                break;
                            }
                        }
                    }
                    return { startRow, bankId, colDate, colDebit, colCredit, colDesc };
                }
            }
            return null;
        },
        parseRow: (row, context) => {
            const date = row[context.colDate];
            const debit = parseAmount(row[context.colDebit]);
            const credit = parseAmount(row[context.colCredit]);
            const descRaw = row[context.colDesc] || '';
            if (date === 'Dư đầu' || date === 'Dư cuối' || (!date && !descRaw)) return null;
            return { date, debit, credit, descRaw };
        }
    },
    MB: {
        detect: (rows, localAppData) => {
            for (let i = 0; i < Math.min(30, rows.length); i++) {
                const rowStr = (rows[i] || []).join(' ').toUpperCase();
                let bankIdFound = Object.keys(localAppData.MASTER).find(k => rowStr.includes(k) && localAppData.MASTER[k].bank === 'MB');
                if (bankIdFound || rowStr.includes('0792901290') || rowStr.includes('MILITARY COMMERCIAL') || rowStr.includes('MB')) {
                    let bankId = bankIdFound || "0792901290";
                    let mbBeneficiaryColIndex = -1;
                    let startRow = 19;
                    let colDate = 4, colDebit = 9, colCredit = 10, colDesc = 11;
                    for (let r = Math.max(0, i); r <= Math.min(rows.length-1, i + 15); r++) {
                        if (rows[r]) {
                            let rUpper = rows[r].map(c => (c || '').toString().toUpperCase());
                            let dateIdx = rUpper.findIndex(c => c.includes('NGÀY GD') || c.includes('GIAO DỊCH'));
                            let debitIdx = rUpper.findIndex(c => c.includes('SỐ TIỀN GHI NỢ') || c.includes('GHI NỢ'));
                            let creditIdx = rUpper.findIndex(c => c.includes('SỐ TIỀN GHI CÓ') || c.includes('GHI CÓ'));
                            let descIdx = rUpper.findIndex(c => c.includes('DIỄN GIẢI') || c.includes('NỘI DUNG'));
                            let benIdx = rUpper.findIndex(c => c.includes('THỤ HƯỞNG') || c.includes('BENEFICIARY') || c.includes('ĐƠN VỊ C/T'));
                            if (dateIdx !== -1 && descIdx !== -1) {
                                startRow = r + 1;
                                colDate = dateIdx; colDebit = debitIdx !== -1 ? debitIdx : 9; colCredit = creditIdx !== -1 ? creditIdx : 10; colDesc = descIdx;
                                mbBeneficiaryColIndex = benIdx;
                                break;
                            }
                        }
                    }
                    return { startRow, bankId, mbBeneficiaryColIndex, colDate, colDebit, colCredit, colDesc };
                }
            }
            return null;
        },
        parseRow: (row, context) => {
            const date = row[context.colDate];
            const debit = parseAmount(row[context.colDebit]);
            const credit = parseAmount(row[context.colCredit]);
            let descRaw = row[context.colDesc] || '';
            let beneficiary = (context.mbBeneficiaryColIndex !== -1 && row[context.mbBeneficiaryColIndex]) ? row[context.mbBeneficiaryColIndex] : '';
            if (beneficiary) descRaw = (descRaw + " - " + beneficiary).trim();
            if (!date && !descRaw) return null;
            return { date, debit, credit, descRaw };
        }
    }
};
