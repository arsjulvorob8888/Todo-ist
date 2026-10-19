create table if not exists sync_records (
  user_id text not null,
  collection text not null,
  record_id text not null,
  payload text not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  primary key (user_id, collection, record_id)
);

create index if not exists sync_records_user_updated
  on sync_records (user_id, updated_at);
