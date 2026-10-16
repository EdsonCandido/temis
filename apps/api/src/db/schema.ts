import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const hosts = sqliteTable("hosts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  sshHost: text("ssh_host"),
  sshPort: integer("ssh_port"),
  sshUser: text("ssh_user"),
  sshKeyPath: text("ssh_key_path"),
  createdAt: integer("created_at").notNull(),
});

export const apps = sqliteTable("apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hostId: integer("host_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url").notNull(),
  githubRef: text("github_ref"),
  dockerfilePath: text("dockerfile_path"),
  internalPort: integer("internal_port").notNull(),
  envText: text("env_text").notNull().default(""),
  proxyJson: text("proxy_json").notNull(),
  status: text("status").notNull().default("idle"),
  lastError: text("last_error"),
  containerName: text("container_name"),
  publishedPort: integer("published_port"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const deployments = sqliteTable("deployments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: integer("app_id").notNull(),
  status: text("status").notNull(),
  log: text("log").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
