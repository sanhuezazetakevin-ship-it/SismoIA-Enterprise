import psycopg
from psycopg import sql

def init_postgres():
    # 1. Connect to default postgres database
    print("Conectando a PostgreSQL local...")
    with psycopg.connect("postgresql://postgres:123456@localhost:5432/postgres", autocommit=True) as conn:
        with conn.cursor() as cur:
            # Check or create role 'user'
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname='user'")
            if not cur.fetchone():
                cur.execute('CREATE ROLE "user" WITH LOGIN PASSWORD \'password\' CREATEDB;')
                print("-> Rol 'user' creado con password 'password'.")
            else:
                cur.execute('ALTER ROLE "user" WITH LOGIN PASSWORD \'password\';')
                print("-> Rol 'user' actualizado.")

            # Check or create role 'sismoia'
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname='sismoia'")
            if not cur.fetchone():
                cur.execute("CREATE ROLE sismoia WITH LOGIN PASSWORD 'sismoia' CREATEDB;")
                print("-> Rol 'sismoia' creado con password 'sismoia'.")
            else:
                cur.execute("ALTER ROLE sismoia WITH LOGIN PASSWORD 'sismoia';")
                print("-> Rol 'sismoia' actualizado.")

            # Check or create database 'sismoia'
            cur.execute("SELECT 1 FROM pg_database WHERE datname='sismoia'")
            if not cur.fetchone():
                cur.execute('CREATE DATABASE sismoia OWNER "user";')
                print("-> Base de datos 'sismoia' creada exitosamente.")
            else:
                print("-> Base de datos 'sismoia' ya existe.")

            cur.execute('GRANT ALL PRIVILEGES ON DATABASE sismoia TO "user";')
            cur.execute('GRANT ALL PRIVILEGES ON DATABASE sismoia TO sismoia;')
            cur.execute('GRANT ALL PRIVILEGES ON DATABASE sismoia TO postgres;')
            print("-> Permisos asignados.")

    # 2. Grant schema permissions on sismoia database
    with psycopg.connect("postgresql://postgres:123456@localhost:5432/sismoia", autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute('GRANT ALL ON SCHEMA public TO "user";')
            cur.execute('GRANT ALL ON SCHEMA public TO sismoia;')
            cur.execute('GRANT ALL ON SCHEMA public TO postgres;')
            print("-> Permisos sobre schema public asignados.")

if __name__ == '__main__':
    init_postgres()
