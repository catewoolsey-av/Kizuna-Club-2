-- Add admin-posted document updates for the Documents sidebar section.

INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read deal documents" ON storage.objects;
CREATE POLICY "Allow public read deal documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'deal-documents');

DROP POLICY IF EXISTS "Allow authenticated upload deal documents" ON storage.objects;
CREATE POLICY "Allow authenticated upload deal documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update deal documents" ON storage.objects;
CREATE POLICY "Allow authenticated update deal documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'deal-documents' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete deal documents" ON storage.objects;
CREATE POLICY "Allow authenticated delete deal documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS document_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  document_url TEXT,
  document_name TEXT,
  posted_by TEXT,
  posted_by_id UUID,
  is_archived BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_updates
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE document_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON document_updates;
CREATE POLICY "Allow all" ON document_updates FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_document_updates_created_at ON document_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_updates_is_archived ON document_updates(is_archived);
