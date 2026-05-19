export function exportAmis(type, processedData, currentBankInfo, currentBankId, localAppData, showToast) {
    const isThu = type === 'THU';
    // Sửa lỗi nghiệp vụ: Thu (Báo Có) -> dòng tiền tăng -> Ghi Có (Credit) trên sao kê > 0
    // Chi (Báo Nợ) -> dòng tiền giảm -> Ghi Nợ (Debit) trên sao kê > 0
    const filterData = processedData.filter(d => isThu ? d.credit > 0 : d.debit > 0);

    if (!filterData.length) return showToast('Không có dữ liệu phù hợp để xuất.', true);

    let exportHeaders = ["Ngày hạch toán (*)", "Ngày chứng từ (*)", "Số chứng từ (*)", "Mã đối tượng", "Tên đối tượng", "Địa chỉ", "Nộp vào/Chi từ TK", "Mở tại ngân hàng", "Lý do", "Diễn giải lý do", "Mã nhân viên", "Diễn giải (hạch toán)", "TK Nợ (*)", "TK Có (*)", "Số tiền"];
    if (!isThu) exportHeaders.unshift("Phương thức thanh toán");

    // Chọn đúng nguồn input STT dựa trên loại phiếu lấy xuất
    const startInput = isThu ? document.getElementById('voucher-start-thu') : document.getElementById('voucher-start-chi');
    const startIdx = parseInt(startInput ? startInput.value : 1) || 1;
    let currentDateStr = null;
    let currentVoucherIdx = startIdx;

    const mappedData = filterData.map((d) => {
        let shortDate = d.date;
        let datePart = d.date.length >= 10 ? d.date.substring(0, 10) : d.date;
        if (d.date.length >= 10) {
            let parts = datePart.split('/');
            if (parts.length === 3) shortDate = parts[2].substring(2, 4) + parts[1] + parts[0];
        }

        if (currentDateStr !== datePart) {
            if (currentDateStr !== null) {
                currentVoucherIdx = 1; // Reset về 1 khi qua ngày mới
            }
            currentDateStr = datePart;
        }

        // Logic cải tiến quy tắc định khoản dựa theo keyword
        let tkNo = isThu ? currentBankInfo.accouantCode : "331";
        let tkCo = isThu ? "131" : currentBankInfo.accouantCode;
        let maNhanVien = "";

        let kwUpper = d.descRule.toUpperCase();
        
        // Loop qua các Rule đã cài đặt
        if (localAppData.ACCOUNTING_RULES && localAppData.ACCOUNTING_RULES.length > 0) {
            for (let r of localAppData.ACCOUNTING_RULES) {
                if (kwUpper.includes(r.keyword.toUpperCase())) {
                    if (isThu === r.isThu) {
                        if (r.tkNo) tkNo = r.tkNo;
                        if (r.tkCo) tkCo = r.tkCo;
                        break; // Áp dụng rule đầu tiên match
                    }
                }
            }
        } else {
            // Fallback an toàn nếu chưa có Rules
            if (kwUpper.includes("PHI CHUYEN TIEN") || kwUpper.includes("BANK FEE")) {
                tkNo = isThu ? currentBankInfo.accouantCode : "642";
                if (!isThu) tkCo = currentBankInfo.accouantCode;
            } else if (kwUpper.includes("TAM UNG")) {
                tkNo = isThu ? currentBankInfo.accouantCode : "141";
                if (!isThu) tkCo = currentBankInfo.accouantCode;
            }
        }

        let countNo = `${isThu ? "BC" : "BN"}.${currentBankInfo.shortCode}.${shortDate}.${String(currentVoucherIdx).padStart(2, '0')}`;
        currentVoucherIdx++;

        let rowData = [
            d.date, d.date, countNo,
            d.entityCode === 'CHECK_AGAIN' ? '' : d.entityCode,
            d.entityName || '', "",
            currentBankId,
            currentBankInfo.branch,
            isThu ? "Thu khác" : "Chi khác",
            d.descRule,
            maNhanVien,
            d.descRule,
            tkNo, tkCo,
            isThu ? d.credit : d.debit // Sửa lại: Lấy số tiền đúng tương ứng với Ghi có/nợ
        ];

        if (!isThu) rowData.unshift("Ủy nhiệm chi");
        return rowData;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...mappedData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isThu ? "BÁO CÓ" : "BÁO NỢ");
    
    let now = new Date();
    let dtSuffix = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
    XLSX.writeFile(workbook, `${isThu ? 'BAO_CO' : 'BAO_NO'}_${currentBankInfo.bank}_${dtSuffix}.xlsx`);
    showToast(`Đã tải xuống file ${isThu ? 'BÁO CÓ' : 'BÁO NỢ'}`);
}
