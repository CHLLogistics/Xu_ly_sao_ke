export function applyRuleEngine(raw) {
    let s = raw.toUpperCase();
    
    // 1. Phí ngân hàng mặc định
    if (/\b(FEE-002|PHI BSMS|PHI QUAN LY|PHI DUY TRI|\bPHI\b.*TRANFER)\b/.test(s)) {
        return "Phí chuyển tiền - BANK FEE TRANFER";
    }

    // 2. Trích xuất tin nhắn thực tế từ các định dạng tin nhắn hệ thống ngân hàng (BIDV/MB)
    
    // Định dạng 1: Chứa DTLS-REF/ (Thường gặp ở BIDV)
    let dtlsMatch = raw.match(/DTLS-REF\/[A-Z0-9_-]+\s+(.*)/i);
    if (dtlsMatch && dtlsMatch[1]) {
        s = dtlsMatch[1].toUpperCase();
    } else {
        // Định dạng 2: Chứa virtual account _@VA hoặc @VA (Thường gặp ở BIDV Virtual Account)
        let vaMatch = raw.match(/@VA(.*?)(?=\s+[A-Z0-9_\-]{6,}|$)/i) || raw.match(/@VA(.*)/i);
        if (vaMatch && vaMatch[1]) {
            s = vaMatch[1].toUpperCase();
        } else {
            // Định dạng 3: Chứa .ND [Nội dung] -CTLN (Tin nhắn của BIDV)
            let bidvMatch = raw.match(/\.\s*ND\s+(.*?)\s+-CTLN/i);
            if (bidvMatch && bidvMatch[1]) {
                s = bidvMatch[1].toUpperCase();
            } else {
                // Fallback B/O match nếu không có DTLS-REF
                let boMatch = s.match(/\bB\/O\s+(.*)/);
                if (boMatch) {
                    s = "B/O " + boMatch[1].trim();
                }
            }
        }
    }

    // 3. Cạo rác hệ thống (Loại bỏ các thành phần kỹ thuật, ID giao dịch, tài khoản, tên công ty của mình)
    let cleaned = s
        // Lọc mẫu MB: CUSTOMER MBCT [NỘI DUNG] D2Q782WA/991539
        .replace(/^CUSTOMER\s+MBCT\s+/gi, '')
        .replace(/\s*[A-Z0-9]+\/\d+\s*-\s*.*$/gi, '')
        
        // Loại bỏ các ID giao dịch hệ thống phổ biến
        .replace(/(FT\d+|MBCT\d+|IBFT|CK TAI QUAY)/gi, '')
        .replace(/GD NGAY \d{2}\/\d{2}/gi, '')
        .replace(/(CHUYEN TIEN CA NHAN|CHUYEN TIEN|REMARK:|\bCUSTOMER\b)/gi, '')
        .replace(/\b(MBBANK|BIDV)\b/gi, '')
        
        // Loại bỏ thông tin tài khoản chuyển nhận
        .replace(/TFR AC:\s*\d+/gi, '')
        .replace(/AC:\s*\d+/gi, '')
        .replace(/O@L_[A-Z0-9_]+/gi, '')
        .replace(/CE\d+_[A-Z0-9_]+/gi, '')
        
        // Loại bỏ tên công ty của mình (C.H.L Logistics) vì đây là bên nhận/gửi cố định, không phải đối tác
        .replace(/CONG TY TNHH GIAI PHAP TIEP VAN C\.H\.L/gi, '')
        .replace(/CONG TY TNHH GIAI PHAP TIEP VAN CHL/gi, '')
        .replace(/CTY TNHH GIAI PHAP TIEP VAN C\.H\.L/gi, '')
        .replace(/CTY TNHH GIAI PHAP TIEP VAN CHL/gi, '')
        .replace(/GIAI PHAP TIEP VAN C\.H\.L/gi, '')
        .replace(/GIAI PHAP TIEP VAN CHL/gi, '')
        .replace(/\bC\.H\.L\b/gi, '')
        .replace(/\bCHL\b/gi, '')
        
        // Loại bỏ các hậu tố rác của hệ thống
        .replace(/BANK CHARGE\s*\.?\d*\s*VAT\s*\.?\d*/gi, '')
        .replace(/BANK CHARGE/gi, '')
        .replace(/VAT\s*\.?\d*/gi, '')
        .replace(/\(\s*_\d+_\s*\)/gi, '') // loại bỏ ID trong ngoặc như (_2601121732021505_)
        .replace(/\(\s*\d+\s*\)/gi, '')
        .replace(/_@VATOP/gi, '')
        .replace(/@VATOP/gi, '')

        // Cắt bỏ phần đuôi ghép tên người gửi nếu còn sót
        .replace(/\s*-\s*[A-Z\s]+$/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Loại bỏ các ký tự rác ở đầu/cuối chuỗi
    cleaned = cleaned.replace(/^[^a-zA-Z0-9À-ỹ]+/g, '').replace(/[^a-zA-Z0-9À-ỹ]+$/g, '').trim();

    // Loại bỏ từ trùng lặp liền nhau (ví dụ: VETC VETC -> VETC)
    let words = cleaned.split(/\s+/);
    let uniqueWords = [];
    for (let i = 0; i < words.length; i++) {
        if (words[i] !== words[i - 1]) {
            uniqueWords.push(words[i]);
        }
    }
    cleaned = uniqueWords.join(' ');

    return cleaned || s;
}
