import json, uuid, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
S = json.load(open(root/"data/scholarships.json"))

def q(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, list): return ("array[" + ",".join(q(x) for x in v) + "]::text[]") if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"
def j(v): return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"

out = ["-- Real scholarships researched on 2026-11-07. Each row lists its sources in the verification column.", "begin;"]
for s in S:
    sid = str(uuid.uuid5(uuid.NAMESPACE_URL, "grantly:" + s["slug"]))
    cov = s.get("coverage") or ("fixed" if (s.get("max") or s.get("min")) else None)
    ver = {"level": s["verification"], "sources": s["sources"], "checked_on": s["last_verified"], "note": s.get("note")}
    out.append(f"""insert into public.scholarships (id, slug, name, name_key, provider, provider_type, scope, destinations, amount_min, amount_max, amount_currency, amount_period, coverage, deadline, deadline_type, reopens_month, status, visibility, exclusive_group, last_verified, other_conditions, source_url, canonical_url, apply_url, verification)
values ({q(sid)}, {q(s['slug'])}, {q(s['name'])}, {q(s['name'].lower())}, {q(s['provider'])}, {q(s['ptype'])}, {q(s['scope'])}, {q(s.get('dest'))}, {q(s.get('min'))}, {q(s.get('max'))}, {q(s['currency'])}, {q(s.get('period'))}, {q(cov)}, {q(s.get('deadline'))}, {q(s['deadline_type'])}, {q(s.get('reopens'))}, 'published', 'public', {q(s.get('exclusive'))}, {q(s['last_verified'])}, {q(s['other'])}, {q(s['url'])}, {q(s['url'])}, {q(s['url'])}, {j(ver)})
on conflict (slug) do update set name = excluded.name, provider = excluded.provider, amount_min = excluded.amount_min, amount_max = excluded.amount_max, amount_period = excluded.amount_period, coverage = excluded.coverage, deadline = excluded.deadline, deadline_type = excluded.deadline_type, reopens_month = excluded.reopens_month, last_verified = excluded.last_verified, other_conditions = excluded.other_conditions, apply_url = excluded.apply_url, verification = excluded.verification;""")
    out.append(f"delete from public.scholarship_criteria where scholarship_id = {q(sid)};")
    for cr in s["criteria"]:
        out.append(f"insert into public.scholarship_criteria (scholarship_id, field, op, value, group_no, fixable_by, source_method) values ({q(sid)}, {q(cr['field'])}, {q(cr['op'])}, {j(cr['value'])}, {cr['group_no']}, {q(cr['fixable_by'])}, 'manual');")
    out.append(f"delete from public.scholarship_documents where scholarship_id = {q(sid)};")
    for d in s["docs"]:
        out.append(f"insert into public.scholarship_documents (scholarship_id, doc_type) values ({q(sid)}, {q(d)}) on conflict do nothing;")
    out.append(f"delete from public.scholarship_steps where scholarship_id = {q(sid)};")
    portal = "the National Scholarship Portal" if "scholarships.gov.in" in s["url"] else "the official portal"
    for i, (t, dt) in enumerate([(f"Register on {portal}", s["url"]), ("Fill in the application form", None), ("Upload documents", "Use the files in your Grantly vault"), ("Submit before the deadline and save the acknowledgement", None)]):
        out.append(f"insert into public.scholarship_steps (scholarship_id, position, title, detail) values ({q(sid)}, {i+1}, {q(t)}, {q(dt)});")
out.append("""insert into public.sources (url, kind, tier, provider, active) values
 ('https://scholarships.gov.in/All-Scholarships', 'index', 'A', 'National Scholarship Portal', false),
 ('https://www.swamidayanand.org/india-scholarships-2026-27', 'detail', 'B', 'Swami Dayanand Education Foundation', true),
 ('https://www.chevening.org/scholarships/application-timeline/', 'detail', 'E', 'Chevening', true)
on conflict (url) do nothing;""")
out.append("commit;")
(root/"supabase/seed.sql").write_text("\n".join(out)+"\n")
mig = (root/"supabase/migrations/20261107000000_init.sql").read_text()
(root/"supabase/setup.sql").write_text("-- Grantly database setup: schema + real scholarship data.\n-- Paste this whole file into Supabase SQL Editor and click Run (only once on a fresh project).\n\n" + mig + "\n\n" + "\n".join(out) + "\n")
print(len(S), "scholarships")
