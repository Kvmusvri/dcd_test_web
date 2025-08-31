import cv2
import numpy as np
import os
import platform
import asyncio
import time
import pickle
from PIL import Image, ImageDraw, ImageFont
import supervision as sv
from supervision.draw.color import Color, ColorPalette
from roboflow import Roboflow

# Глобальные переменные для моделей
_rf = None
_workspace = None
_wheels_project = None
_doors_project = None
_main_project = None
_wheels_model = None
_doors_model = None
_main_model = None
# Новые модели для сегментации повреждений
_damage_project_1 = None
_damage_project_2 = None
_damage_project_3 = None
_damage_project_4 = None  # Новая модель коррозии
_damage_model_1 = None
_damage_model_2 = None
_damage_model_3 = None
_damage_model_4 = None  # Новая модель коррозии
_damage_models_initialized = False
_models_initialized = False

# Путь для кэширования моделей
_CACHE_DIR = "roboflow_cache"
_MODEL_CACHE_FILE = os.path.join(_CACHE_DIR, "models.pkl")


def save_models_to_cache():
    """Сохранение моделей в кэш."""
    global _rf, _workspace, _wheels_project, _doors_project, _main_project
    global _wheels_model, _doors_model, _main_model
    global _damage_project_1, _damage_project_2, _damage_project_3, _damage_project_4
    global _damage_model_1, _damage_model_2, _damage_model_3, _damage_model_4, _damage_models_initialized

    try:
        cache_data = {
            'rf': _rf,
            'workspace': _workspace,
            'wheels_project': _wheels_project,
            'doors_project': _doors_project,
            'main_project': _main_project,
            'wheels_model': _wheels_model,
            'doors_model': _doors_model,
            'main_model': _main_model,
            'initialized': _models_initialized,
            # Новые модели повреждений
            'damage_project_1': _damage_project_1,
            'damage_project_2': _damage_project_2,
            'damage_project_3': _damage_project_3,
            'damage_project_4': _damage_project_4,
            'damage_model_1': _damage_model_1,
            'damage_model_2': _damage_model_2,
            'damage_model_3': _damage_model_3,
            'damage_model_4': _damage_model_4,
            'damage_initialized': _damage_models_initialized
        }

        os.makedirs(_CACHE_DIR, exist_ok=True)
        with open(_MODEL_CACHE_FILE, 'wb') as f:
            pickle.dump(cache_data, f)

        print("💾 Модели сохранены в кэш")
    except Exception as e:
        print(f"⚠️ Не удалось сохранить кэш моделей: {e}")


def load_models_from_cache():
    """Загрузка моделей из кэша."""
    global _rf, _workspace, _wheels_project, _doors_project, _main_project
    global _wheels_model, _doors_model, _main_model, _models_initialized
    global _damage_project_1, _damage_project_2, _damage_project_3, _damage_project_4
    global _damage_model_1, _damage_model_2, _damage_model_3, _damage_model_4, _damage_models_initialized

    if not os.path.exists(_MODEL_CACHE_FILE):
        return False

    try:
        with open(_MODEL_CACHE_FILE, 'rb') as f:
            cache_data = pickle.load(f)

        _rf = cache_data.get('rf')
        _workspace = cache_data.get('workspace')
        _wheels_project = cache_data.get('wheels_project')
        _doors_project = cache_data.get('doors_project')
        _main_project = cache_data.get('main_project')
        _wheels_model = cache_data.get('wheels_model')
        _doors_model = cache_data.get('doors_model')
        _main_model = cache_data.get('main_model')
        _models_initialized = cache_data.get('initialized', False)

        # Загрузка новых моделей повреждений
        _damage_project_1 = cache_data.get('damage_project_1')
        _damage_project_2 = cache_data.get('damage_project_2')
        _damage_project_3 = cache_data.get('damage_project_3')
        _damage_project_4 = cache_data.get('damage_project_4')
        _damage_model_1 = cache_data.get('damage_model_1')
        _damage_model_2 = cache_data.get('damage_model_2')
        _damage_model_3 = cache_data.get('damage_model_3')
        _damage_model_4 = cache_data.get('damage_model_4')
        _damage_models_initialized = cache_data.get('damage_initialized', False)

        print("📂 Модели загружены из кэша")
        return True
    except Exception as e:
        print(f"⚠️ Не удалось загрузить кэш моделей: {e}")
        return False


def initialize_models():
    """Инициализация моделей Roboflow с кэшированием."""
    global _rf, _workspace, _wheels_project, _doors_project, _main_project
    global _wheels_model, _doors_model, _main_model, _models_initialized

    if _models_initialized:
        print("✅ Используем кэшированные модели Roboflow")
        return

    # Пробуем загрузить из кэша
    if load_models_from_cache():
        if _models_initialized:
            return

    print("🔄 Инициализация моделей Roboflow...")
    start_time = time.time()

    if _rf is None:
        print("  📡 Подключение к Roboflow...")
        _rf = Roboflow(api_key="ZeQTHe67dxC1eTiDwklO")

    if _workspace is None:
        print("  🏢 Загрузка workspace...")
        _workspace = _rf.workspace()

    if _wheels_project is None:
        print("  🚗 Загрузка проекта колес...")
        _wheels_project = _workspace.project("parts-car")

    if _doors_project is None:
        print("  🚪 Загрузка проекта дверей...")
        _doors_project = _workspace.project("car-parts-ulbml")

    if _main_project is None:
        print("  🚙 Загрузка основного проекта...")
        _main_project = _workspace.project("cars-parts-and-damages_3")

    if _wheels_model is None:
        print("  ⚙️ Загрузка модели колес...")
        _wheels_model = _wheels_project.version(1).model

    if _doors_model is None:
        print("  ⚙️ Загрузка модели дверей...")
        _doors_model = _doors_project.version(1).model

    if _main_model is None:
        print("  ⚙️ Загрузка основной модели...")
        _main_model = _main_project.version(2).model

    _models_initialized = True
    end_time = time.time()
    print(".2f")

    # Сохраняем в кэш
    save_models_to_cache()


def initialize_damage_models():
    """Инициализация моделей повреждений Roboflow."""
    global _rf, _workspace, _damage_project_1, _damage_project_2, _damage_project_3, _damage_project_4
    global _damage_model_1, _damage_model_2, _damage_model_3, _damage_model_4, _damage_models_initialized

    if _damage_models_initialized:
        print("✅ Используем кэшированные модели повреждений")
        return

    # Пробуем загрузить из кэша
    if load_models_from_cache():
        if _damage_models_initialized:
            return

    print("🔄 Инициализация моделей повреждений Roboflow...")
    start_time = time.time()

    # Инициализируем базовые объекты, если не инициализированы
    if _rf is None:
        print("  📡 Подключение к Roboflow...")
        _rf = Roboflow(api_key="ZeQTHe67dxC1eTiDwklO")

    if _workspace is None:
        print("  🏢 Загрузка workspace...")
        _workspace = _rf.workspace()

    # Инициализация моделей повреждений
    if _damage_project_1 is None:
        print("  🚗 Загрузка проекта повреждений 1...")
        _damage_project_1 = _workspace.project("car-damage-detection-frmnl")

    if _damage_project_2 is None:
        print("  🚗 Загрузка проекта повреждений 2...")
        _damage_project_2 = _workspace.project("car-damage-detection-vyhvw")

    if _damage_project_3 is None:
        print("  🚗 Загрузка проекта повреждений 3...")
        _damage_project_3 = _workspace.project("bilgi-university-car-damage")

    if _damage_project_4 is None:
        print("  🚗 Загрузка проекта коррозии...")
        _damage_project_4 = _workspace.project("corrosion-hsmae")

    if _damage_model_1 is None:
        print("  ⚙️ Загрузка модели повреждений 1...")
        _damage_model_1 = _damage_project_1.version(3).model

    if _damage_model_2 is None:
        print("  ⚙️ Загрузка модели повреждений 2...")
        _damage_model_2 = _damage_project_2.version(6).model

    if _damage_model_3 is None:
        print("  ⚙️ Загрузка модели повреждений 3...")
        _damage_model_3 = _damage_project_3.version(1).model

    if _damage_model_4 is None:
        print("  ⚙️ Загрузка модели коррозии...")
        _damage_model_4 = _damage_project_4.version(5).model

    _damage_models_initialized = True
    end_time = time.time()
    print(".2f")

    # Сохраняем в кэш
    save_models_to_cache()


async def predict_single_model(model, path, confidence, model_name):
    """Асинхронное предсказание для одной модели."""
    start_time = time.time()

    print(f"🔄 Запрос к модели '{model_name}' (confidence={confidence})...")

    # Используем ThreadPoolExecutor для синхронного API Roboflow
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        lambda: model.predict(path, confidence=confidence).json()
    )

    end_time = time.time()

    # Логируем результат
    predictions_count = len(result.get('predictions', []))
    print(".2f")
    if predictions_count > 0:
        classes = [p.get('class', 'unknown') for p in result['predictions'][:3]]
        print(f"   📋 Получено {predictions_count} лейблов: {classes}")
    else:
        print("   📋 Получено 0 лейблов")

    return result


async def get_predictions_async(path):
    """Настоящая асинхронная обработка - все модели запускаются одновременно."""
    initialize_models()

    print(f"🚀 Запуск одновременных асинхронных предсказаний для: {os.path.basename(path)}")

    # Создаем задачи для всех трех моделей ОДНОВРЕМЕННО
    tasks = [
        predict_single_model(_wheels_model, path, 30, "wheels"),
        predict_single_model(_doors_model, path, 10, "doors"),
        predict_single_model(_main_model, path, 30, "main")
    ]

    print("📡 Все 3 запроса отправлены одновременно, ждем ответы...")

    # Ждем завершения всех задач параллельно
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Обрабатываем результаты
    wheels_result = results[0] if not isinstance(results[0], Exception) and results[0] else {"predictions": [], "image": {"width": 640, "height": 480}}
    doors_result = results[1] if not isinstance(results[1], Exception) and results[1] else {"predictions": [], "image": {"width": 640, "height": 480}}
    main_result = results[2] if not isinstance(results[2], Exception) and results[2] else {"predictions": [], "image": {"width": 640, "height": 480}}

    print("✅ Все ответы получены, продолжаем обработку")
    return wheels_result, doors_result, main_result


async def get_damage_predictions_async(path):
    """Асинхронная обработка повреждений с использованием четырех моделей."""
    print("🔧 Инициализация моделей повреждений...")
    initialize_damage_models()

    # Проверяем, что модели инициализированы
    if not _damage_models_initialized:
        print("❌ Модели повреждений не инициализированы!")
        return {"predictions": []}, {"predictions": []}, {"predictions": []}, {"predictions": []}

    if _damage_model_1 is None or _damage_model_2 is None or _damage_model_3 is None or _damage_model_4 is None:
        print("❌ Некоторые модели повреждений равны None!")
        print(f"  _damage_model_1: {_damage_model_1 is not None}")
        print(f"  _damage_model_2: {_damage_model_2 is not None}")
        print(f"  _damage_model_3: {_damage_model_3 is not None}")
        print(f"  _damage_model_4: {_damage_model_4 is not None}")
        return {"predictions": []}, {"predictions": []}, {"predictions": []}, {"predictions": []}

    print(f"🚨 Запуск асинхронных предсказаний повреждений для: {os.path.basename(path)}")

    # Создаем задачи для четырех моделей повреждений
    tasks = [
        predict_single_model(_damage_model_1, path, 40, "damage_1"),
        predict_single_model(_damage_model_2, path, 40, "damage_2"),
        predict_single_model(_damage_model_3, path, 40, "damage_3"),
        predict_single_model(_damage_model_4, path, 40, "damage_4")
    ]

    print("📡 Все 4 запроса повреждений отправлены одновременно, ждем ответы...")

    # Ждем завершения всех задач параллельно
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Проверяем результаты на ошибки
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"❌ Ошибка в модели повреждений {i+1}: {result}")

    # Обрабатываем результаты
    damage_result_1 = results[0] if not isinstance(results[0], Exception) and results[0] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_2 = results[1] if not isinstance(results[1], Exception) and results[1] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_3 = results[2] if not isinstance(results[2], Exception) and results[2] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_4 = results[3] if not isinstance(results[3], Exception) and results[3] else {"predictions": [], "image": {"width": 640, "height": 480}}

    print("✅ Все ответы повреждений получены, продолжаем обработку")
    print(f"📊 Результаты: dmg1={len(damage_result_1.get('predictions', []))} dmg2={len(damage_result_2.get('predictions', []))} dmg3={len(damage_result_3.get('predictions', []))} dmg4={len(damage_result_4.get('predictions', []))}")

    return damage_result_1, damage_result_2, damage_result_3, damage_result_4


async def get_full_union_predictions_async(path):
    """Асинхронная обработка ПОЛНОГО ОБЪЕДИНЕНИЯ - все модели одновременно (детали + повреждения)."""
    # Создаем задачи для всех семи моделей ОДНОВРЕМЕННО
    tasks = [
        predict_single_model(_wheels_model, path, 30, "wheels"),
        predict_single_model(_doors_model, path, 10, "doors"),
        predict_single_model(_main_model, path, 30, "main"),
        predict_single_model(_damage_model_1, path, 20, "damage_1"),
        predict_single_model(_damage_model_2, path, 20, "damage_2"),
        predict_single_model(_damage_model_3, path, 20, "damage_3"),
        predict_single_model(_damage_model_4, path, 20, "damage_4")
    ]

    print("📡 Все 7 запросов отправлены одновременно, ждем ответы...")

    # Ждем завершения всех задач параллельно
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Обрабатываем результаты с подробной отладкой
    wheels_result = results[0] if not isinstance(results[0], Exception) and results[0] else {"predictions": [], "image": {"width": 640, "height": 480}}
    doors_result = results[1] if not isinstance(results[1], Exception) and results[1] else {"predictions": [], "image": {"width": 640, "height": 480}}
    main_result = results[2] if not isinstance(results[2], Exception) and results[2] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_1 = results[3] if not isinstance(results[3], Exception) and results[3] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_2 = results[4] if not isinstance(results[4], Exception) and results[4] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_3 = results[5] if not isinstance(results[5], Exception) and results[5] else {"predictions": [], "image": {"width": 640, "height": 480}}
    damage_result_4 = results[6] if not isinstance(results[6], Exception) and results[6] else {"predictions": [], "image": {"width": 640, "height": 480}}

    # Подробная отладка результатов
    print("🔍 ПОЛУЧЕННЫЕ РЕЗУЛЬТАТЫ ОТ МОДЕЛЕЙ:")
    print("  🔧 Детали автомобиля:")
    print(f"    • Колеса: {len(wheels_result.get('predictions', []))} предсказаний")
    if wheels_result.get('predictions'):
        classes = [p.get('class', 'unknown') for p in wheels_result['predictions'][:3]]
        print(f"      Лейблы: {classes}")
    print(f"    • Двери: {len(doors_result.get('predictions', []))} предсказаний")
    if doors_result.get('predictions'):
        classes = [p.get('class', 'unknown') for p in doors_result['predictions'][:3]]
        print(f"      Лейблы: {classes}")
    print(f"    • Основная: {len(main_result.get('predictions', []))} предсказаний")
    if main_result.get('predictions'):
        classes = [p.get('class', 'unknown') for p in main_result['predictions'][:3]]
        print(f"      Лейблы: {classes}")

    print("  🔧 Повреждения автомобиля:")
    print(f"    • Повреждения 1: {len(damage_result_1.get('predictions', []))} предсказаний")
    if damage_result_1.get('predictions'):
        classes = [p.get('class', 'unknown') for p in damage_result_1['predictions'][:3]]
        print(f"      Лейблы: {classes}")
    print(f"    • Повреждения 2: {len(damage_result_2.get('predictions', []))} предсказаний")
    if damage_result_2.get('predictions'):
        classes = [p.get('class', 'unknown') for p in damage_result_2['predictions'][:3]]
        print(f"      Лейблы: {classes}")
    print(f"    • Повреждения 3: {len(damage_result_3.get('predictions', []))} предсказаний")
    if damage_result_3.get('predictions'):
        classes = [p.get('class', 'unknown') for p in damage_result_3['predictions'][:3]]
        print(f"      Лейблы: {classes}")
    print(f"    • Коррозия: {len(damage_result_4.get('predictions', []))} предсказаний")
    if damage_result_4.get('predictions'):
        classes = [p.get('class', 'unknown') for p in damage_result_4['predictions'][:3]]
        print(f"      Лейблы: {classes}")

    # Проверяем на ошибки
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            model_names = ["wheels", "doors", "main", "damage_1", "damage_2", "damage_3", "damage_4"]
            print(f"❌ Ошибка в модели {model_names[i]}: {result}")

    print("✅ Все ответы получены, продолжаем обработку полного объединения")

    return wheels_result, doors_result, main_result, damage_result_1, damage_result_2, damage_result_3, damage_result_4


def create_damage_combined_result(damage_result_1, damage_result_2, damage_result_3, damage_result_4):
    """Создание объединенного результата только для моделей повреждений."""
    all_predictions = []
    all_predictions.extend(damage_result_1.get("predictions", []))
    all_predictions.extend(damage_result_2.get("predictions", []))
    all_predictions.extend(damage_result_3.get("predictions", []))
    all_predictions.extend(damage_result_4.get("predictions", []))

    # Используем image данные из первой модели, если они есть
    image_data = damage_result_1.get("image", {"width": 0, "height": 0})

    return {
        "predictions": all_predictions,
        "image": image_data
    }


def create_full_damage_combined_result(wheels_result, doors_result, main_result, damage_result_1, damage_result_2, damage_result_3, damage_result_4):
    """Создание объединенного результата для всех моделей (детали + повреждения)."""
    all_predictions = []
    all_predictions.extend(wheels_result.get("predictions", []))
    all_predictions.extend(doors_result.get("predictions", []))
    all_predictions.extend(main_result.get("predictions", []))
    all_predictions.extend(damage_result_1.get("predictions", []))
    all_predictions.extend(damage_result_2.get("predictions", []))
    all_predictions.extend(damage_result_3.get("predictions", []))
    all_predictions.extend(damage_result_4.get("predictions", []))

    # Используем image данные из первой доступной модели
    image_data = None
    for result in [damage_result_1, damage_result_2, damage_result_3, damage_result_4, wheels_result, doors_result, main_result]:
        if result.get("image") and result["image"].get("width") and result["image"].get("height"):
            image_data = result["image"]
            break

    # Fallback значения если ни одна модель не вернула корректные image данные
    if not image_data:
        image_data = {"width": 640, "height": 480}  # Стандартные размеры

    print(f"📏 Используемые размеры изображения: {image_data['width']}x{image_data['height']}")

    return {
        "predictions": all_predictions,
        "image": image_data
    }


def filter_predictions(wheels_result, doors_result, main_result):
    """Фильтрация предсказаний по классам."""
    # Фильтрация main_result - убираем колеса и двери
    exclude_classes = ["W", "FD", "RD", "HL", "DM", "TL", "OL", "dmg_LD", "dmg_SC"]
    filtered_main = [pred for pred in main_result["predictions"]
                     if pred["class"] not in exclude_classes]

    # Фильтрация wheels_result - берем только колеса
    wheels_classes = ["Roda", "Pneu", "Teto", "Janela"]
    filtered_wheels = [pred for pred in wheels_result["predictions"]
                       if pred["class"] in wheels_classes]

    # Фильтрация doors_result - берем только двери
    doors_classes = [
        "back_left_door", "back_right_door", "back_right_light",
        "back_left_light", "front_left_door", "front_right_door",
        "front_left_light", "front_right_light", "left_mirror",
        "right_mirror"
    ]
    filtered_doors = [pred for pred in doors_result["predictions"]
                      if pred["class"] in doors_classes]

    return filtered_main, filtered_wheels, filtered_doors


def apply_class_mapping(filtered_main, filtered_wheels, filtered_doors):
    """Применение переименования классов."""
    class_mapping = {
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

    for pred in filtered_main:
        pred["class"] = class_mapping.get(pred["class"], pred["class"])

    for pred in filtered_wheels:
        pred["class"] = class_mapping.get(pred["class"], pred["class"])

    for pred in filtered_doors:
        pred["class"] = class_mapping.get(pred["class"], pred["class"])

    return filtered_main, filtered_wheels, filtered_doors


def apply_damage_class_mapping(damage_result_1, damage_result_2, damage_result_3, damage_result_4):
    """Фильтрация и переименование классов повреждений."""

    # Разрешенные классы (только эти останутся)
    allowed_classes = {
        'gocuk', 'kirik-kayip', 'cam_catlagi', 'cizik',  # bilgi модель
        'crack', 'scratch', 'dent',  # английские модели
        'korosi'  # модель коррозии
    }

    # Маппинг для переименования
    damage_class_mapping = {
        # Модель bilgi-university-car-damage/1 (турецкий)
        'gocuk': 'Складка',
        'kirik-kayip': 'Утрата фрагментов',
        'cam_catlagi': 'Трещина',
        'cizik': 'Царапина',

        # Модель car-damage-detection-vyhvw/6 (английский)
        'crack': 'Трещина',
        'scratch': 'Царапина',
        'dent': 'Вмятина',

        # Модель car-damage-detection-frmnl/3 (английский)
        'crack': 'Трещина',
        'scratch': 'Царапина',
        'dent': 'Вмятина',

        # Модель corrosion-hsmae/5 (коррозия)
        'korosi': 'Поверхностная коррозия'
    }

    # ФИЛЬТРУЕМ И ПЕРЕИМЕНОВЫВАЕМ
    for result in [damage_result_1, damage_result_2, damage_result_3, damage_result_4]:
        if result and result.get("predictions"):
            # ШАГ 1: Фильтруем только разрешенные классы
            result["predictions"] = [
                pred for pred in result["predictions"]
                if pred.get("class") in allowed_classes
            ]

            # ШАГ 2: Переименовываем отфильтрованные классы
            for pred in result["predictions"]:
                if pred.get("class") in damage_class_mapping:
                    pred["class"] = damage_class_mapping[pred["class"]]

    return damage_result_1, damage_result_2, damage_result_3, damage_result_4


def create_combined_result(filtered_main, filtered_wheels,
                          filtered_doors, main_result):
    """Создание объединенного результата."""
    all_predictions = []
    all_predictions.extend(filtered_main)
    all_predictions.extend(filtered_wheels)
    all_predictions.extend(filtered_doors)

    # Возвращаем image данные из main_result, если они есть
    if main_result and main_result.get("image") and main_result["image"].get("width") and main_result["image"].get("height"):
        image_data = main_result["image"]
    else:
        image_data = {"width": 640, "height": 480}  # Fallback значения

    print(f"📏 Используемые размеры изображения для деталей: {image_data['width']}x{image_data['height']}")

    return {
        "predictions": all_predictions,
        "image": image_data
    }


def create_full_union_combined_result(filtered_main, filtered_wheels, filtered_doors,
                                     filtered_damage_1, filtered_damage_2, filtered_damage_3,
                                     main_result):
    """Создание объединенного результата для полного объединения."""
    all_predictions = []
    all_predictions.extend(filtered_main)
    all_predictions.extend(filtered_wheels)
    all_predictions.extend(filtered_doors)
    all_predictions.extend(filtered_damage_1)
    all_predictions.extend(filtered_damage_2)
    all_predictions.extend(filtered_damage_3)

    # Возвращаем image данные из main_result, если они есть
    image_data = main_result.get("image", {"width": 0, "height": 0})

    return {
        "predictions": all_predictions,
        "image": image_data
    }


# Модели будут инициализированы при запуске приложения через lifespan manager
print("ℹ️ Модели будут загружены при запуске сервера")