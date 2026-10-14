#!/bin/bash
while true; do
    echo "[$(date)] Запуск планового оновлення новин..."
    python run_feed.py
    echo "Оновлення завершено. Наступний запуск через 1 годину..."
    sleep 3600
done
