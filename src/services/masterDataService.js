import { supabase } from '../lib/supabase.js';

export async function loadAllMasterData() {
    try {
        const [
            { data: masterAccounts, error: errAccounts },
            { data: dmDoiTuong, error: errDoiTuong },
            { data: entities, error: errEntities },
            { data: accountingRules, error: errRules },
            { data: specialRules, error: errSpecial }
        ] = await Promise.all([
            supabase.from('master_accounts').select('*'),
            supabase.from('dm_doi_tuong').select('*'),
            supabase.from('entities').select('*'),
            supabase.from('accounting_rules').select('*'),
            supabase.from('special_rules').select('*')
        ]);

        if (errAccounts) throw errAccounts;
        if (errDoiTuong) throw errDoiTuong;
        if (errEntities) throw errEntities;
        if (errRules) throw errRules;
        if (errSpecial) throw errSpecial;

        // Transform master_accounts to MASTER object
        const MASTER = {};
        masterAccounts.forEach(acc => {
            MASTER[acc.account_number] = {
                bank: acc.bank,
                shortCode: acc.short_code,
                accouantCode: acc.account_code,
                description: acc.description,
                branch: acc.branch
            };
        });

        // Transform entities to ENTITIES object
        const ENTITIES = {};
        entities.forEach(ent => {
            ENTITIES[ent.code] = ent.name;
        });

        // Transform DM_DOI_TUONG
        const DM_DOI_TUONG = dmDoiTuong.map(d => ({
            keyword: d.keyword,
            code: d.code
        }));

        // Transform ACCOUNTING_RULES
        const ACCOUNTING_RULES = accountingRules.map(r => ({
            keyword: r.keyword,
            isThu: r.is_thu,
            tkNo: r.tk_no || '',
            tkCo: r.tk_co || ''
        }));

        // Transform SPECIAL_RULES
        const SPECIAL_RULES = specialRules.map(r => ({
            condition: r.condition,
            cutFrom: r.cut_from || '',
            cutTo: r.cut_to || '',
            format: r.format
        }));

        return {
            MASTER,
            DM_DOI_TUONG,
            ENTITIES,
            ACCOUNTING_RULES,
            SPECIAL_RULES
        };
    } catch (error) {
        console.error('Failed to load master data from Supabase:', error);
        throw error;
    }
}

// === ENTITIES CRUD ===
export async function addEntity(code, name) {
    const { data, error } = await supabase
        .from('entities')
        .insert([{ code, name }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function updateEntity(code, newName) {
    const { data, error } = await supabase
        .from('entities')
        .update({ name: newName })
        .eq('code', code)
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteEntity(code) {
    const { error } = await supabase
        .from('entities')
        .delete()
        .eq('code', code);
    if (error) throw error;
}

// === DM_DOI_TUONG (MAPPING RULES) CRUD ===
export async function addMappingRule(keyword, code) {
    const { data, error } = await supabase
        .from('dm_doi_tuong')
        .insert([{ keyword, code }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function updateMappingRule(keyword, newCode) {
    const { data, error } = await supabase
        .from('dm_doi_tuong')
        .update({ code: newCode })
        .eq('keyword', keyword)
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteMappingRule(keyword) {
    const { error } = await supabase
        .from('dm_doi_tuong')
        .delete()
        .eq('keyword', keyword);
    if (error) throw error;
}

// === MASTER_ACCOUNTS CRUD ===
export async function addMasterAccount(accountNumber, bank, shortCode, accountCode, description, branch) {
    const { data, error } = await supabase
        .from('master_accounts')
        .insert([{
            account_number: accountNumber,
            bank,
            short_code: shortCode,
            account_code: accountCode,
            description,
            branch
        }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function updateMasterAccount(accountNumber, bank, shortCode, accountCode, description, branch) {
    const { data, error } = await supabase
        .from('master_accounts')
        .update({
            bank,
            short_code: shortCode,
            account_code: accountCode,
            description,
            branch
        })
        .eq('account_number', accountNumber)
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteMasterAccount(accountNumber) {
    const { error } = await supabase
        .from('master_accounts')
        .delete()
        .eq('account_number', accountNumber);
    if (error) throw error;
}

// === ACCOUNTING_RULES CRUD ===
export async function addAccountingRule(keyword, isThu, tkNo, tkCo) {
    const { data, error } = await supabase
        .from('accounting_rules')
        .insert([{ keyword, is_thu: isThu, tk_no: tkNo || null, tk_co: tkCo || null }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function updateAccountingRule(keyword, isThu, tkNo, tkCo) {
    const { data, error } = await supabase
        .from('accounting_rules')
        .update({ is_thu: isThu, tk_no: tkNo || null, tk_co: tkCo || null })
        .eq('keyword', keyword)
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteAccountingRule(keyword) {
    const { error } = await supabase
        .from('accounting_rules')
        .delete()
        .eq('keyword', keyword);
    if (error) throw error;
}

// === SPECIAL_RULES CRUD ===
export async function addSpecialRule(condition, cutFrom, cutTo, format) {
    const { data, error } = await supabase
        .from('special_rules')
        .insert([{
            condition,
            cut_from: cutFrom || null,
            cut_to: cutTo || null,
            format
        }])
        .select();
    if (error) throw error;
    return data[0];
}

export async function deleteSpecialRule(condition) {
    const { error } = await supabase
        .from('special_rules')
        .delete()
        .eq('condition', condition);
    if (error) throw error;
}
