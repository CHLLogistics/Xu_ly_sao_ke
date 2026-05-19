-- Enable RLS (just in case it was missed in migration)
ALTER TABLE public.master_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_doi_tuong ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_rules ENABLE ROW LEVEL SECURITY;

-- 1. Policies for master_accounts
DROP POLICY IF EXISTS "Allow public read access to master_accounts" ON public.master_accounts;
DROP POLICY IF EXISTS "Allow authenticated write access to master_accounts" ON public.master_accounts;
CREATE POLICY "Allow public read access to master_accounts" ON public.master_accounts FOR SELECT USING (true);
CREATE POLICY "Allow public write access to master_accounts" ON public.master_accounts FOR ALL USING (true) WITH CHECK (true);

-- 2. Policies for dm_doi_tuong
DROP POLICY IF EXISTS "Allow public read access to dm_doi_tuong" ON public.dm_doi_tuong;
DROP POLICY IF EXISTS "Allow authenticated write access to dm_doi_tuong" ON public.dm_doi_tuong;
CREATE POLICY "Allow public read access to dm_doi_tuong" ON public.dm_doi_tuong FOR SELECT USING (true);
CREATE POLICY "Allow public write access to dm_doi_tuong" ON public.dm_doi_tuong FOR ALL USING (true) WITH CHECK (true);

-- 3. Policies for entities
DROP POLICY IF EXISTS "Allow public read access to entities" ON public.entities;
DROP POLICY IF EXISTS "Allow authenticated write access to entities" ON public.entities;
CREATE POLICY "Allow public read access to entities" ON public.entities FOR SELECT USING (true);
CREATE POLICY "Allow public write access to entities" ON public.entities FOR ALL USING (true) WITH CHECK (true);

-- 4. Policies for accounting_rules
DROP POLICY IF EXISTS "Allow public read access to accounting_rules" ON public.accounting_rules;
DROP POLICY IF EXISTS "Allow authenticated write access to accounting_rules" ON public.accounting_rules;
CREATE POLICY "Allow public read access to accounting_rules" ON public.accounting_rules FOR SELECT USING (true);
CREATE POLICY "Allow public write access to accounting_rules" ON public.accounting_rules FOR ALL USING (true) WITH CHECK (true);

-- 5. Policies for special_rules
DROP POLICY IF EXISTS "Allow public read access to special_rules" ON public.special_rules;
DROP POLICY IF EXISTS "Allow authenticated write access to special_rules" ON public.special_rules;
CREATE POLICY "Allow public read access to special_rules" ON public.special_rules FOR SELECT USING (true);
CREATE POLICY "Allow public write access to special_rules" ON public.special_rules FOR ALL USING (true) WITH CHECK (true);
