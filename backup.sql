--
-- PostgreSQL database dump
--

\restrict w8rCEayhtECcTRqulQSDinDuENHRD1mS1QE6rb2qJLVW9BQPfa0urVFIdGdJ5dM

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
3e0e5b3b-5277-4ecf-be2e-574aeb13f8a3	335d46fd39e453ded84de14ba37db24cd2d97cc7f016fb624129af1ab6e93a82	\N	20241230_add_performance_indexes	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20241230_add_performance_indexes\n\nDatabase error code: 42P01\n\nDatabase error:\nERROR: relation "videos" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \\"videos\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(639), routine: Some("RangeVarGetRelidExtended") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20241230_add_performance_indexes"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20241230_add_performance_indexes"\n             at schema-engine\\core\\src\\commands\\apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:226	2026-01-01 14:51:48.205116-06	2026-01-01 14:50:52.743185-06	0
48a88f39-71b6-427d-8666-7d371f544788	335d46fd39e453ded84de14ba37db24cd2d97cc7f016fb624129af1ab6e93a82	2026-01-01 14:51:48.207622-06	20241230_add_performance_indexes		\N	2026-01-01 14:51:48.207622-06	0
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict w8rCEayhtECcTRqulQSDinDuENHRD1mS1QE6rb2qJLVW9BQPfa0urVFIdGdJ5dM

