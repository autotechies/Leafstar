-- =====================================================================
-- 007 — Inventory helpers (Step 5)
-- Run in the Supabase SQL Editor after 006_stock_entries.sql.
--   add_colour        : add a colour (with its photos, sizes and opening stock) to an existing article, all or nothing
--   add_size          : add a size to every colour of an article
--   set_colour_photos : replace a colour's photos in one step; the old files are cleaned up later
-- =====================================================================

-- p = { article_id, name, code, hex, images:[{thumb_url,medium_url,url,blur_data_url,width,height}], stock:{"S":10} }
create or replace function add_colour(p jsonb) returns uuid
language plpgsql as $$
declare
  aid uuid := (p ->> 'article_id')::uuid;
  acode text; cid uuid; vid uuid; img jsonb; sz record; q integer; ci integer;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select code into acode from articles where id = aid;
  if acode is null then raise exception 'Article not found'; end if;
  select coalesce(max(sort_order) + 1, 0) into ci from article_colors where article_id = aid;
  insert into article_colors (article_id, name, code, hex, sort_order)
  values (aid, trim(p ->> 'name'), upper(trim(p ->> 'code')), p ->> 'hex', ci) returning id into cid;

  for img in select * from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) loop
    insert into article_images (article_id, color_id, thumb_url, medium_url, url, blur_data_url, width, height, sort_order)
    values (aid, cid, img ->> 'thumb_url', img ->> 'medium_url', img ->> 'url', img ->> 'blur_data_url',
            nullif(img ->> 'width', '')::integer, nullif(img ->> 'height', '')::integer,
            coalesce((select max(sort_order) + 1 from article_images where color_id = cid), 0));
  end loop;

  -- One variant per size the article already has.
  for sz in select distinct size, min(size_order) as size_order from variants where article_id = aid group by size loop
    insert into variants (article_id, color_id, size, size_order, sku)
    values (aid, cid, sz.size, sz.size_order, upper(acode || '-' || trim(p ->> 'code') || '-' || sz.size)) returning id into vid;
    q := coalesce(nullif(p -> 'stock' ->> sz.size, '')::integer, 0);
    if q < 0 then raise exception 'Stock cannot be negative'; end if;
    if q > 0 then
      insert into stock_movements (variant_id, qty_change, reason, created_by, note)
      values (vid, q, 'opening', auth.uid(), 'Opening stock of added colour');
    end if;
  end loop;
  return cid;
end $$;
revoke execute on function add_colour(jsonb) from public, anon;

create or replace function add_size(p_article_id uuid, p_size text) returns integer
language plpgsql as $$
declare acode text; sz text := upper(trim(p_size)); n integer; pos integer;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select code into acode from articles where id = p_article_id;
  if acode is null then raise exception 'Article not found'; end if;
  if sz = '' then raise exception 'Choose a size'; end if;
  select count(distinct size) into pos from variants where article_id = p_article_id;
  insert into variants (article_id, color_id, size, size_order, sku)
  select p_article_id, c.id, sz, size_rank(sz, pos), upper(acode || '-' || c.code || '-' || sz)
    from article_colors c
   where c.article_id = p_article_id
     and not exists (select 1 from variants v where v.color_id = c.id and v.size = sz);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'This size already exists for every colour'; end if;
  return n;
end $$;
revoke execute on function add_size(uuid, text) from public, anon;

-- Replace all photos of a colour at once. Files of removed photos are released (they are deleted by the
-- scheduled cleanup after a day), so a mistaken replacement can still be noticed.
create or replace function set_colour_photos(p_color_id uuid, p_images jsonb) returns integer
language plpgsql as $$
declare aid uuid; img jsonb; i integer := 0; old record;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  select article_id into aid from article_colors where id = p_color_id;
  if aid is null then raise exception 'Colour not found'; end if;
  if jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images) = 0 then
    raise exception 'Add at least one photo';
  end if;
  for old in select url from article_images where color_id = p_color_id loop
    update image_uploads set attached_at = null, created_at = now() where position(folder in old.url) > 0;
  end loop;
  delete from article_images where color_id = p_color_id;
  for img in select * from jsonb_array_elements(p_images) loop
    insert into article_images (article_id, color_id, thumb_url, medium_url, url, blur_data_url, width, height, sort_order)
    values (aid, p_color_id, img ->> 'thumb_url', img ->> 'medium_url', img ->> 'url', img ->> 'blur_data_url',
            nullif(img ->> 'width', '')::integer, nullif(img ->> 'height', '')::integer, i);
    i := i + 1;
  end loop;
  return i;
end $$;
revoke execute on function set_colour_photos(uuid, jsonb) from public, anon;
