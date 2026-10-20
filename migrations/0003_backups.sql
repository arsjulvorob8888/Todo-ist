create table if not exists backups (
  user_id text not null,
  name text not null,
  saved_at text not null,
  path text not null,
  payload text not null,
  primary key (user_id, name)
);
