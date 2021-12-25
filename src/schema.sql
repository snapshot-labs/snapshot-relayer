CREATE TABLE messages (
  address VARCHAR(42) NOT NULL,
  hash VARCHAR(66) NOT NULL,
  ts BIGINT NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (address, hash),
  INDEX ts (ts)
);
