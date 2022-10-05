CREATE TABLE messages (
  address VARCHAR(42) NOT NULL,
  hash VARCHAR(66) NOT NULL,
  msg_hash VARCHAR(66) NOT NULL,
  ts BIGINT NOT NULL,
  payload JSON NOT NULL,
  network VARCHAR(24) NOT NULL,
  env VARCHAR(24) NOT NULL,
  PRIMARY KEY (address, hash),
  INDEX ts (ts),
  INDEX msg_hash (msg_hash)
);
