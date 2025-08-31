import os
from pathlib import Path

# Пути к директориям
BASE_DIR = Path(__file__).parent.parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
SERVICES_DIR = BASE_DIR / "services"
UTILS_DIR = BASE_DIR / "utils"

# Настройки приложения
APP_TITLE = "DCD Vision Web App"
APP_DESCRIPTION = "Web приложение для анализа деталей автомобилей с помощью ИИ"
APP_VERSION = "1.0.0"

# Настройки сервера
HOST = "0.0.0.0"
PORT = 8000

# Настройки обработки изображений
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}

# Настройки моделей Roboflow
ROBOFLOW_API_KEY = "ZeQTHe67dxC1eTiDwklO"
CACHE_DIR = BASE_DIR / "roboflow_cache"
MODEL_CACHE_FILE = CACHE_DIR / "models.pkl"

# Настройки обработки
CONFIDENCE_THRESHOLDS = {
    'wheels': 30,
    'doors': 10,
    'main': 30
}

# Классы для фильтрации
EXCLUDE_CLASSES = ["W", "FD", "RD", "HL", "DM", "TL", "OL", "dmg_LD"]
WHEELS_CLASSES = ["Roda", "Pneu", "Teto", "Janela"]
DOORS_CLASSES = [
    "back_left_door", "back_right_door", "back_right_light",
    "back_left_light", "front_left_door", "front_right_door",
    "front_left_light", "front_right_light", "left_mirror",
    "right_mirror"
]

# Маппинг классов
CLASS_MAPPING = {
    # Основная модель
    "FF": "КРЫЛО П", "Q": "БОКОВИНА В СБ З", "FS": "СТЕКЛО ЛОБОВОЕ",
    "RS": "СТЕКЛО ЗАДНЕЕ", "RNP": "НОМЕРНОЙ ЗНАК З",
    "FNP": "НОМЕРНОЙ ЗНАК П", "FB": "БАМПЕР", "B": "КАПОТ",
    "G": "РАДИАТОР",

    # Модель колес
    "Roda": "КОЛЕСНЫЙ ДИСК", "Pneu": "ШИНА", "Teto": "КРЫША",
    "Janela": "Стекло", "emblem": "ЭМБЛЕМА ПРОИЗВОДИТЕЛЯ",
    "Tampa Gas": "ЛЮЧОК Т/БАКА",

    # Модель дверей
    "back_left_door": "ДВЕРЬ З Л", "back_right_door": "ДВЕРЬ З ПР",
    "back_right_light": "ГАБ ФОНАРЬ З ПР",
    "back_left_light": "ГАБ ФОНАРЬ З Л", "front_left_door": "ДВЕРЬ П Л",
    "front_right_door": "ДВЕР П ПР", "front_left_light": "ФАРА В СБОРЕ Л",
    "front_right_light": "ФАРА В СБОРЕ ПР", "left_mirror": "ЗЕРКАЛО НАР Л",
    "right_mirror": "ЗЕРКАЛО НАР ПР"
}
