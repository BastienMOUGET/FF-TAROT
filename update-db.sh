#!/bin/bash

DB_NAME="fft"

echo ">>> Update DB"

sudo mariadb $DB_NAME < db.sql

echo ">>> OK"