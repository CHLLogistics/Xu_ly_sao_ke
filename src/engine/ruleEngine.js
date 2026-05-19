export function applyRuleEngine(raw) {
    let s = raw.toUpperCase();
    if (/\b(FEE-002|PHI BSMS|PHI QUAN LY|PHI DUY TRI|\bPHI\b.*TRANFER)\b/.test(s)) return "Phí chuyển tiền - BANK FEE TRANFER";
    
    let boMatch = s.match(/\bB\/O\s+(.*)/);
    if (boMatch) return "B/O " + boMatch[1].trim();
    
    let bidvMatch = raw.match(/\.\s*ND\s+(.*?)\s+-CTLN/i);
    if (bidvMatch && bidvMatch[1]) return bidvMatch[1].trim();
    
    // Thuật toán: Cạo rác hệ thống ngân hàng để lấy tin nhắn gốc
    let cleaned = s
        // Lọc mẫu cực khó MB: CUSTOMER MBCT [NỘI DUNG] D2Q782WA/991539 - NGUYEN VAN A
        .replace(/^CUSTOMER\s+MBCT\s+/i, '')
        .replace(/\s*[A-Z0-9]+\/\d+\s*-\s*.*$/i, '')
        // Lọc mẫu phổ thông
        .replace(/(FT\d+|MBCT\d+|IBFT|CK TAI QUAY)/g, '')
        .replace(/GD NGAY \d{2}\/\d{2}/g, '')
        .replace(/(CHUYEN TIEN CA NHAN|CHUYEN TIEN|REMARK:|\bCUSTOMER\b)/g, '')
        .replace(/\b(MBBANK|BIDV)\b/g, '')
        // Cắt bỏ phần đuôi ghép - TÊN NGƯỜI GỬI (nếu còn sót) để lấy đúng nội dung tin nhắn
        .replace(/\s*-\s*[A-Z\s]+$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
        
    return cleaned || s;
}
