create extension if not exists pgcrypto;


create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  full_name text,
  email text,
  scope_pref text[] not null default '{india}',
  course_level text,
  stream text,
  course_name text,
  year_of_study int,
  marks_value numeric,
  marks_system text check (marks_system in ('percent','cgpa')),
  cgpa_scale numeric,
  family_income_inr bigint,
  state text,
  gender text check (gender in ('female','male','other','undisclosed')),
  category text,
  minority text,
  disability boolean,
  nationality text default 'IN',
  target_countries text[],
  english_test_score numeric,
  work_experience_years numeric,
  field_source jsonb not null default '{}',
  reminder_email boolean not null default true,
  reminder_days int[] not null default '{14,3,1}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  doc_type text not null,
  storage_path text not null,
  file_name text,
  issued_on date,
  valid_until date,
  extracted jsonb not null default '{}',
  extract_status text not null default 'pending' check (extract_status in ('pending','done','failed','manual','queued')),
  extract_source text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.documents(user_id);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  kind text not null default 'detail' check (kind in ('index','detail','pdf')),
  tier char(1) not null default 'B',
  provider text,
  template text,
  check_every interval not null default '7 days',
  last_fetched_at timestamptz,
  last_hash text,
  last_error text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_key text,
  provider text,
  provider_type text check (provider_type in ('government','private','institution','international')),
  scope text not null default 'domestic' check (scope in ('domestic','international')),
  destinations text[],
  source_id uuid references public.sources(id) on delete set null,
  source_url text,
  canonical_url text,
  apply_url text,
  amount_min numeric,
  amount_max numeric,
  amount_currency char(3) not null default 'INR',
  amount_period text check (amount_period in ('year','month','one_time','total')),
  coverage text check (coverage in ('full','partial','fixed')),
  renewable boolean,
  opens_on date,
  deadline date,
  deadline_type text not null default 'fixed' check (deadline_type in ('fixed','rolling','unknown')),
  reopens_month int check (reopens_month between 1 and 12),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  owner_id uuid references public.profiles(id) on delete cascade,
  track_only boolean not null default false,
  exclusive_group text,
  trust jsonb not null default '{}',
  verification jsonb not null default '{}',
  field_meta jsonb not null default '{}',
  last_verified date,
  other_conditions text[] not null default '{}',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.scholarships(status, visibility);
create index on public.scholarships(canonical_url);
create index on public.scholarships(name_key);

create table public.scholarship_criteria (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  field text not null,
  op text not null,
  value jsonb not null,
  kind text not null default 'hard' check (kind in ('hard','soft')),
  fixable_by text,
  evidence text,
  group_no int not null default 0,
  source_method text not null default 'manual' check (source_method in ('template','rules','llm','manual')),
  model text,
  confidence numeric not null default 1
);
create index on public.scholarship_criteria(scholarship_id);

create table public.scholarship_documents (
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  doc_type text not null,
  required boolean not null default true,
  primary key (scholarship_id, doc_type)
);

create table public.scholarship_steps (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  position int not null,
  title text not null,
  detail text
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('ingest_source','ingest_url','ocr_document','recheck_source','send_reminders')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  user_id uuid references public.profiles(id) on delete cascade,
  attempts int not null default 0,
  result jsonb,
  error text,
  llm_used boolean not null default false,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.jobs(status, run_after);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  scholarship_id uuid not null references public.scholarships(id) on delete cascade,
  status text not null default 'saved' check (status in ('saved','preparing','applied','awaiting','disbursed','renewal_due')),
  applied_on date,
  renewal_due date,
  notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, scholarship_id)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  type text not null check (type in ('deadline','document_expiring','renewal','start_preparing')),
  fire_on date not null,
  channel text not null default 'email',
  sent_at timestamptz,
  unique (user_id, application_id, document_id, type, fire_on)
);

create table public.llm_cache (
  key text primary key,
  model text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

create table public.llm_usage (
  day date not null default current_date,
  provider text not null,
  calls int not null default 0,
  failures int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  primary key (day, provider)
);

create table public.llm_provider_state (
  provider text primary key,
  cooldown_until timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create table public.system_runs (
  name text primary key,
  last_run_at timestamptz not null default now(),
  ok boolean not null default true,
  details jsonb not null default '{}'
);

create or replace function public.claim_job(worker_types text[] default null)
returns setof public.jobs
language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs
   where status = 'queued' and run_after <= now()
     and (worker_types is null or type = any(worker_types))
   order by created_at
   limit 1
   for update skip locked;
  if not found then return; end if;
  update public.jobs set status = 'running', started_at = now(), attempts = attempts + 1 where id = j.id returning * into j;
  return next j;
end $$;
revoke execute on function public.claim_job(text[]) from public, anon, authenticated;

create or replace function public.add_llm_usage(p_provider text, p_in int, p_out int, p_ok boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.llm_usage(day, provider, calls, failures, tokens_in, tokens_out)
  values (current_date, p_provider, 1, case when p_ok then 0 else 1 end, p_in, p_out)
  on conflict (day, provider) do update set calls = llm_usage.calls + 1,
    failures = llm_usage.failures + case when p_ok then 0 else 1 end,
    tokens_in = llm_usage.tokens_in + p_in, tokens_out = llm_usage.tokens_out + p_out;
$$;
revoke execute on function public.add_llm_usage(text, int, int, boolean) from public, anon, authenticated;

create or replace function public.sweep_jobs(stale_minutes int default 10)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.jobs set status = case when attempts >= 3 then 'failed' else 'queued' end,
         error = coalesce(error, '') || ' [swept: running too long]',
         run_after = now() + interval '5 minutes',
         finished_at = case when attempts >= 3 then now() else null end
   where status = 'running' and started_at < now() - make_interval(mins => stale_minutes);
  get diagnostics n = row_count;
  update public.documents set extract_status = 'failed'
   where extract_status = 'pending' and created_at < now() - interval '10 minutes';
  return n;
end $$;
revoke execute on function public.sweep_jobs(int) from public, anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.protect_admin_flag() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.is_admin := false;
    else new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end $$;
create trigger t_protect_admin before insert or update on public.profiles for each row execute function public.protect_admin_flag();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_scholarships before update on public.scholarships for each row execute function public.touch_updated_at();
create trigger t_applications before update on public.applications for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.sources enable row level security;
alter table public.scholarships enable row level security;
alter table public.scholarship_criteria enable row level security;
alter table public.scholarship_documents enable row level security;
alter table public.scholarship_steps enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.reminders enable row level security;
alter table public.llm_cache enable row level security;
alter table public.llm_usage enable row level security;

create policy own_profile on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy admin_read_profiles on public.profiles for select to authenticated using ((select public.is_admin()));

create policy own_documents on public.documents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy own_applications on public.applications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy own_reminders_read on public.reminders for select to authenticated
  using (user_id = (select auth.uid()));

create policy own_jobs_read on public.jobs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy read_scholarships on public.scholarships for select to anon, authenticated
  using ((status = 'published' and visibility = 'public') or owner_id = (select auth.uid()) or (select public.is_admin()));

create policy admin_scholarships on public.scholarships for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy read_criteria on public.scholarship_criteria for select to anon, authenticated
  using (exists (select 1 from public.scholarships s where s.id = scholarship_id));
create policy read_sdocs on public.scholarship_documents for select to anon, authenticated
  using (exists (select 1 from public.scholarships s where s.id = scholarship_id));
create policy read_steps on public.scholarship_steps for select to anon, authenticated
  using (exists (select 1 from public.scholarships s where s.id = scholarship_id));

create policy admin_criteria on public.scholarship_criteria for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_sdocs on public.scholarship_documents for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_steps on public.scholarship_steps for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_sources on public.sources for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_usage on public.llm_usage for select to authenticated using ((select public.is_admin()));
alter table public.llm_provider_state enable row level security;
alter table public.system_runs enable row level security;
create policy admin_provider_state on public.llm_provider_state for select to authenticated using ((select public.is_admin()));
create policy admin_runs on public.system_runs for select to authenticated using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

create policy own_files_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy own_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy own_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
