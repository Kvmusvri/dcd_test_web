import cv2
import numpy as np
import os
import platform
from PIL import Image, ImageDraw, ImageFont
import supervision as sv
from supervision.draw.color import Color, ColorPalette


def load_and_convert_image(path):
    """Загрузка и конвертация изображения."""
    image = cv2.imread(path)
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def get_polygon_colors():
    """Инициализация словаря для хранения цветов полигонов."""
    return {}


def assign_color_to_label(label, detection_idx, polygon_colors):
    """Назначение цвета для лейбла."""
    if label not in polygon_colors:
        if label == "ШИНА":
            polygon_colors[label] = Color.RED
            print(f"🎨 Назначен специальный цвет для ШИНЫ: {Color.RED}")
        else:
            colors = ColorPalette.DEFAULT
            color = colors.by_idx(detection_idx)
            polygon_colors[label] = color
            print(f"🎨 Назначен цвет #{detection_idx} для {label}: {color}")

    print(f"   Возвращаем цвет для {label}: {polygon_colors[label]}")
    return polygon_colors[label]


def draw_masks_and_remember_colors(scene, detections, labels,
                                  polygon_colors):
    """Рисование масок и запоминание цветов."""
    colored_mask = np.array(scene, copy=True, dtype=np.uint8)

    # Рисуем маски в порядке площади (большие сначала)
    if hasattr(detections, 'area') and len(detections.area) > 0:
        sorted_indices = np.argsort(detections.area)[::-1]
    else:
        # Если area недоступна, используем порядок по умолчанию
        sorted_indices = range(len(labels))

    for detection_idx in sorted_indices:
        label = labels[detection_idx]
        mask = detections.mask[detection_idx]

        # Назначаем цвет для лейбла
        color = assign_color_to_label(label, detection_idx,
                                      polygon_colors)

        print(f"🎨 Назначен цвет для {label}: {color} (BGR: {color.as_bgr()})")
        print(f"   polygon_colors после назначения: {list(polygon_colors.keys())}")

        # Рисуем полигон с запомненным цветом
        colored_mask[mask] = color.as_bgr()

    # Накладываем маски на изображение
    cv2.addWeighted(colored_mask, 0.5, scene, 0.5, 0, scene)
    return scene


def get_font(size=16):
    """Кроссплатформенный выбор шрифта."""
    system = platform.system()

    if system == "Windows":
        font_paths = [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "C:/Windows/Fonts/tahoma.ttf",
            "C:/Windows/Fonts/msyh.ttc",
            "C:/Windows/Fonts/simsun.ttc"
        ]
    elif system == "Linux":
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/"
            "LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/"
            "LiberationSans-Regular.ttf"
        ]
    else:  # macOS
        font_paths = [
            "/System/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf"
        ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                return ImageFont.truetype(font_path, size)
            except:
                continue

    return ImageFont.load_default()


def check_label_bounds(x1, y1, text_width, text_height, image_width,
                       image_height):
    """Проверка границ лейбла."""
    x2 = x1 + text_width + 10
    y2 = y1
    y1_adjusted = y1 - 25

    # Проверяем выход за границы
    if x1 < 0:
        x1 = 0
        x2 = text_width + 10
    if x2 > image_width:
        x1 = image_width - text_width - 10
        x2 = image_width
    if y1_adjusted < 0:
        y1_adjusted = 25
        y2 = y1_adjusted + text_height
    if y2 > image_height:
        y1_adjusted = image_height - text_height
        y2 = image_height

    return x1, y1_adjusted, x2, y2


def check_overlap_with_margin(rect1, rect2, margin=5):
    """Проверка пересечения прямоугольников с отступом."""
    rect1_expanded = [
        rect1[0] - margin,
        rect1[1] - margin,
        rect1[2] + margin,
        rect1[3] + margin
    ]
    rect2_expanded = [
        rect2[0] - margin,
        rect2[1] - margin,
        rect2[2] + margin,
        rect2[3] + margin
    ]

    return not (rect1_expanded[2] <= rect2_expanded[0] or
               rect1_expanded[0] >= rect2_expanded[2] or
               rect1_expanded[3] <= rect2_expanded[1] or
               rect1_expanded[1] >= rect2_expanded[3])


def find_non_overlapping_position(x1, y1, text_width, text_height,
                                 occupied_areas, image_width, image_height,
                                 max_attempts=20):
    """Поиск непересекающейся позиции для лейбла с улучшенной логикой."""
    base_x1, base_y1_adjusted, base_x2, base_y2 = check_label_bounds(
        x1, y1, text_width, text_height, image_width, image_height)

    # Проверяем пересечение с занятыми областями
    current_rect = [base_x1, base_y1_adjusted, base_x2, base_y2]

    # Если нет пересечений - используем базовую позицию
    has_overlap = False
    for occupied in occupied_areas:
        if check_overlap_with_margin(current_rect, occupied):
            has_overlap = True
            break

    if not has_overlap:
        return current_rect

    # Генерируем больше вариантов позиций
    attempts = []

    # Вертикальные смещения
    for offset in [30, 60, 90, -30, -60, -90]:
        attempts.append((base_x1, base_y1_adjusted + offset))

    # Горизонтальные смещения
    for offset in [text_width + 15, -(text_width + 15),
                   text_width + 45, -(text_width + 45)]:
        attempts.append((base_x1 + offset, base_y1_adjusted))

    # Диагональные смещения
    diagonal_offsets = [
        (text_width//2 + 10, -40), (text_width//2 + 10, 40),
        (-text_width//2 - 10, -40), (-text_width//2 - 10, 40),
        (text_width + 20, -20), (-text_width - 20, -20),
        (text_width + 20, 20), (-text_width - 20, 20)
    ]
    for dx, dy in diagonal_offsets:
        attempts.append((base_x1 + dx, base_y1_adjusted + dy))

    # Пробуем каждый вариант
    for attempt_x, attempt_y in attempts:
        # Проверяем границы
        attempt_rect = list(check_label_bounds(
            attempt_x, attempt_y, text_width, text_height,
            image_width, image_height))

        # Проверяем пересечения со всеми занятыми областями
        overlaps = False
        for occupied in occupied_areas:
            if check_overlap_with_margin(attempt_rect, occupied):
                overlaps = True
                break

        if not overlaps:
            return attempt_rect

    # Если не нашли хорошую позицию - используем базовую
    return current_rect


def add_labels_to_image(pil_image, detections, labels, polygon_colors):
    """Добавление лейблов на изображение с учетом границ и пересечений."""
    draw = ImageDraw.Draw(pil_image)
    font = get_font(16)

    image_width, image_height = pil_image.size
    occupied_areas = []

    # Сортируем детекции по размеру (большие объекты обрабатываем первыми)
    if hasattr(detections, 'area') and len(detections.area) > 0:
        sorted_indices = np.argsort(detections.area)[::-1]
    else:
        # Если area недоступна, используем порядок по умолчанию
        sorted_indices = range(len(labels))

    for idx in sorted_indices:
        box = detections.xyxy[idx]
        label = labels[idx]

        x1, y1, x2, y2 = box

        # Берем цвет полигона для лейбла
        mask_color = polygon_colors[label]
        mask_color_rgb = mask_color.as_bgr()

        # Получаем размеры текста
        bbox = draw.textbbox((0, 0), label, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Находим подходящую позицию для лейбла
        label_rect = find_non_overlapping_position(
            x1, y1, text_width, text_height, occupied_areas,
            image_width, image_height)

        # Добавляем область в занятые
        occupied_areas.append(label_rect)

        # Рисуем цветной прямоугольник под текстом
        draw.rectangle(label_rect, fill=mask_color_rgb)

        # Рисуем белый текст
        draw.text((label_rect[0] + 5, label_rect[1] + 5), label,
                  fill=(255, 255, 255), font=font)

    return pil_image


def create_detections_from_results(combined_result):
    """Создание детекций из результатов инференса."""
    return sv.Detections.from_inference(combined_result)


def get_labels_from_predictions(all_predictions):
    """Получение лейблов из предсказаний."""
    return [item["class"] for item in all_predictions]


def create_masks_from_detections(detections, labels, image_shape):
    """Создание отдельных масок для каждого класса."""
    height, width = image_shape[:2]
    masks_dict = {}

    for i, (detection, label) in enumerate(zip(detections, labels)):
        if hasattr(detection, 'mask') and detection.mask is not None:
            mask = detection.mask

            # Создаем бинарную маску для этого объекта
            binary_mask = np.zeros((height, width), dtype=np.uint8)
            binary_mask[mask] = 255

            if label not in masks_dict:
                masks_dict[label] = []
            masks_dict[label].append(binary_mask)

    return masks_dict


def create_combined_mask_image(detections, labels, image_shape, polygon_colors):
    """Создание изображения с цветными масками без оригинального фото."""
    height, width = image_shape[:2]
    mask_image = np.zeros((height, width, 3), dtype=np.uint8)

    # Рисуем маски в порядке площади (большие сначала)
    if hasattr(detections, 'area') and len(detections.area) > 0:
        sorted_indices = np.argsort(detections.area)[::-1]
    else:
        sorted_indices = range(len(labels))

    for detection_idx in sorted_indices:
        label = labels[detection_idx]
        mask = detections.mask[detection_idx]

        # Назначаем цвет для лейбла
        color = assign_color_to_label(label, detection_idx, polygon_colors)

        # Рисуем маску с цветом
        mask_image[mask] = color.as_bgr()

    return mask_image


def create_mask_image(original_path, predictions, file_id):
    """Создание изображения маски из предсказаний."""
    import cv2
    import numpy as np

    print("🎭 Создание изображения маски из предсказаний...")

    # Загружаем оригинальное изображение для получения размеров
    original_image = cv2.imread(original_path)
    if original_image is None:
        print(f"❌ Не удалось загрузить изображение: {original_path}")
        return None

    height, width = original_image.shape[:2]
    mask_image = np.zeros((height, width, 3), dtype=np.uint8)

    print(f"📐 Размеры изображения: {width}x{height}")
    print(f"📊 Количество предсказаний: {len(predictions)}")

    # Получаем цвета полигонов
    polygon_colors = get_polygon_colors()

    for i, prediction in enumerate(predictions):
        # Получаем координаты полигона
        if 'points' in prediction:
            points = prediction['points']
            if len(points) >= 3:  # Минимум 3 точки для полигона
                # Создаем маску из координат полигона
                binary_mask = np.zeros((height, width), dtype=np.uint8)
                polygon_points = np.array([[int(point['x']), int(point['y'])] for point in points], dtype=np.int32)

                # Заполняем полигон
                cv2.fillPoly(binary_mask, [polygon_points], 255)

                # Назначаем цвет для класса
                class_name = prediction.get('class', f'class_{i}')
                print(f"🔍 Обработка prediction {i}: class='{class_name}', has_color={('color' in prediction)}, color_value={prediction.get('color')}")

                # Получаем цвет из polygon_colors или создаем новый
                if polygon_colors and class_name in polygon_colors:
                    color = polygon_colors[class_name]
                    color_rgb = color.as_bgr()  # OpenCV использует BGR
                    print(f"✅ Используем цвет из polygon_colors для {class_name}: {color_rgb}")
                else:
                    # Создаем цвет на основе хэша
                    import colorsys
                    hue = hash(class_name) % 360
                    rgb = colorsys.hsv_to_rgb(hue / 360, 0.7, 0.8)
                    color_rgb = (int(rgb[2] * 255), int(rgb[1] * 255), int(rgb[0] * 255))  # BGR
                    print(f"🆕 Создаем новый цвет для {class_name}: {color_rgb}")

                # Создаем объект Color для совместимости
                try:
                    from supervision.draw.color import Color
                    color = Color.from_bgr(color_rgb[0], color_rgb[1], color_rgb[2])
                except Exception as e:
                    print(f"⚠️ Не удалось создать Color объект: {e}")
                    # Fallback - создаем простой объект с as_bgr методом
                    color = type('Color', (), {'as_bgr': lambda: color_rgb})()

                # Применяем цвет к маске
                mask_image[binary_mask == 255] = color_rgb

    print("✅ Изображение маски создано")
    return mask_image


def create_detections_from_predictions(predictions, image_path):
    """Создание detections из predictions для совместимости с существующими функциями."""
    import cv2
    import numpy as np
    from supervision import Detections

    print("🔄 Конвертируем predictions в detections...")

    # Загружаем изображение для получения размеров
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Не удалось загрузить изображение: {image_path}")
        return Detections.empty()

    height, width = image.shape[:2]

    # Конвертируем predictions в формат detections
    xyxy_list = []
    confidence_list = []
    class_id_list = []

    for prediction in predictions:
        # Получаем bbox
        if 'bbox' in prediction and len(prediction['bbox']) >= 4:
            x1, y1, x2, y2 = prediction['bbox']
            xyxy_list.append([x1, y1, x2, y2])
            confidence_list.append(float(prediction.get('confidence', 0.5)))
            class_id_list.append(0)  # Пока используем один класс
        elif 'points' in prediction and prediction['points']:
            # Если нет bbox, но есть points, создаем bbox из points
            points = prediction['points']
            if len(points) > 0:
                x_coords = []
                y_coords = []

                for point in points:
                    if isinstance(point, dict) and 'x' in point and 'y' in point:
                        x_coords.append(float(point['x']))
                        y_coords.append(float(point['y']))
                    elif isinstance(point, list) and len(point) >= 2:
                        x_coords.append(float(point[0]))
                        y_coords.append(float(point[1]))

                if x_coords and y_coords:
                    x1, x2 = min(x_coords), max(x_coords)
                    y1, y2 = min(y_coords), max(y_coords)
                    xyxy_list.append([x1, y1, x2, y2])
                    confidence_list.append(float(prediction.get('confidence', 0.5)))
                    class_id_list.append(0)

    if not xyxy_list:
        print("⚠️ Не найдено ни одного bbox в predictions")
        return Detections.empty()

    # Создаем detections
    xyxy_array = np.array(xyxy_list, dtype=np.float32)
    confidence_array = np.array(confidence_list, dtype=np.float32)
    class_id_array = np.array(class_id_list, dtype=np.int32)

    detections = Detections(
        xyxy=xyxy_array,
        confidence=confidence_array,
        class_id=class_id_array
    )

    print(f"✅ Создано {len(detections)} detections из predictions")

    # Отладка: проверяем размеры detections
    if len(detections) > 0:
        print("🔍 Размеры detections:")
        for i in range(min(5, len(detections))):
            x1, y1, x2, y2 = detections.xyxy[i]
            width = x2 - x1
            height = y2 - y1
            print(f"  [{i}] Размер: {width:.0f}x{height:.0f}, confidence: {detections.confidence[i]:.3f}")

    return detections


def create_overlay_image_from_detections(image_path, detections, file_id):
    """Создание overlay изображения из detections."""
    import cv2
    import numpy as np

    print("🎨 Создание overlay из detections...")

    # Загружаем оригинальное изображение
    original_image = cv2.imread(image_path)
    if original_image is None:
        print(f"❌ Не удалось загрузить изображение: {image_path}")
        return original_image

    # Создаем маску из detections
    mask_image = create_mask_image_from_detections(image_path, detections, file_id)

    # Создаем overlay
    alpha = 0.7
    overlay = cv2.addWeighted(original_image, 1 - alpha, mask_image, alpha, 0)

    print("✅ Overlay создан")
    return overlay


def create_mask_image_from_detections(image_path, detections, file_id):
    """Создание маски из detections."""
    import cv2
    import numpy as np

    print("🎭 Создание маски из detections...")
    print(f"🔍 Количество detections: {len(detections)}")

    # Загружаем изображение для получения размеров
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Не удалось загрузить изображение: {image_path}")
        return np.zeros((100, 100, 3), dtype=np.uint8)

    height, width = image.shape[:2]
    mask_image = np.zeros((height, width, 3), dtype=np.uint8)

    print(f"📐 Размер изображения: {width}x{height}")

    # Получаем цвета полигонов
    polygon_colors = get_polygon_colors()

    # Отладка detections
    if len(detections) > 0:
        print("🔍 Первые detections:")
        for i in range(min(5, len(detections))):
            x1, y1, x2, y2 = detections.xyxy[i]
            w, h = x2 - x1, y2 - y1
            conf = detections.confidence[i]
            print(f"  [{i}] bbox: ({x1:.0f},{y1:.0f}) size: {w:.0f}x{h:.0f}, conf: {conf:.3f}")

    # Рисуем detections на маске
    for i, (xyxy, confidence, class_id) in enumerate(zip(detections.xyxy, detections.confidence, detections.class_id)):
        x1, y1, x2, y2 = xyxy

        # Назначаем цвет для класса
        class_name = f'class_{class_id}'

        # Получаем цвет из polygon_colors или создаем новый
        if polygon_colors and class_name in polygon_colors:
            color = polygon_colors[class_name]
            color_rgb = color.as_bgr()
        else:
            # Создаем цвет на основе хэша
            import colorsys
            hue = hash(class_name) % 360
            rgb = colorsys.hsv_to_rgb(hue / 360, 0.7, 0.8)
            color_rgb = (int(rgb[2] * 255), int(rgb[1] * 255), int(rgb[0] * 255))

        # Рисуем прямоугольник
        cv2.rectangle(mask_image, (int(x1), int(y1)), (int(x2), int(y2)), color_rgb, -1)

    print("✅ Маска создана из detections")
    return mask_image


def create_overlay_image(original_image, mask_image, alpha=0.7):
    """Создание наложения маски на оригинальное изображение."""
    print(f"🎨 Создание overlay с прозрачностью {alpha}")
    overlay = cv2.addWeighted(original_image, 1 - alpha, mask_image, alpha, 0)
    return overlay


def save_image_to_tmp(image_array, filename="result.jpg", file_id=None):
    """Сохранение изображения в папку tmp."""
    import os
    import time

    # Генерируем уникальное имя файла
    if file_id:
        timestamp = int(time.time())
        unique_filename = f"result_{file_id}_{timestamp}.jpg"
    else:
        unique_filename = filename

    filepath = os.path.join("tmp", unique_filename)
    pil_image = Image.fromarray(image_array)
    pil_image.save(filepath)
    return filepath


def create_individual_polygon_masks_from_predictions(predictions, image_shape, polygon_colors):
    """Создание отдельных масок для каждого полигона из предсказаний Roboflow."""
    height, width = image_shape[:2]
    individual_masks = {}

    for i, prediction in enumerate(predictions):
        # Получаем координаты полигона из Roboflow
        if 'points' in prediction:
            # Roboflow возвращает points как массив координат [x, y]
            points = prediction['points']
            if len(points) >= 3:  # Минимум 3 точки для полигона
                # Создаем маску из координат полигона
                binary_mask = np.zeros((height, width), dtype=np.uint8)
                polygon_points = np.array([[int(point['x']), int(point['y'])] for point in points], dtype=np.int32)

                # Заполняем полигон
                cv2.fillPoly(binary_mask, [polygon_points], 255)

                # Создаем цветную маску
                colored_mask = np.zeros((height, width, 3), dtype=np.uint8)

                # Назначаем цвет для класса
                class_name = prediction.get('class', f'class_{i}')
                print(f"🎨 Создание маски для {class_name}, доступные цвета: {list(polygon_colors.keys()) if polygon_colors else []}")

                # Сначала пробуем найти цвет в polygon_colors
                if polygon_colors and class_name in polygon_colors:
                    color = polygon_colors[class_name]
                    print(f"✅ Найден существующий цвет для {class_name}")
                else:
                    # Если не нашли, создаем новый
                    color = assign_color_to_label(class_name, i, polygon_colors or {})
                    print(f"🆕 Создан новый цвет для {class_name}: {color}")

                try:
                    colored_mask[binary_mask == 255] = color.as_bgr()
                    print(f"✅ Маска для {class_name} окрашена в {color.as_bgr()}")
                except Exception as e:
                    print(f"❌ Ошибка при окраске маски для {class_name}: {e}")
                    # Fallback цвет
                    colored_mask[binary_mask == 255] = [255, 0, 0]  # Красный

                polygon_id = f'polygon_{i}'

                individual_masks[polygon_id] = {
                    'binary_mask': binary_mask,
                    'colored_mask': colored_mask,
                    'class': class_name,
                    'confidence': float(prediction.get('confidence', 0.0)),
                    'bbox': prediction.get('bbox', [0, 0, 0, 0]),
                    'points': points,  # Сохраняем оригинальные координаты
                    'color': color if 'color' in locals() else '#FF6B6B'  # Дефолтный цвет вместо None
                }

    return individual_masks


def create_individual_polygon_masks(detections, labels, image_shape, polygon_colors):
    """Создание отдельных масок для каждого полигона (fallback для старого формата)."""
    height, width = image_shape[:2]
    individual_masks = {}

    for i, (detection, label) in enumerate(zip(detections, labels)):
        if hasattr(detection, 'mask') and detection.mask is not None:
            mask = detection.mask

            # Создаем бинарную маску для этого полигона
            binary_mask = np.zeros((height, width), dtype=np.uint8)
            binary_mask[mask] = 255

            # Создаем цветную маску для этого полигона
            colored_mask = np.zeros((height, width, 3), dtype=np.uint8)

            # Назначаем цвет для лейбла
            color = assign_color_to_label(label, i, polygon_colors)
            colored_mask[mask] = color.as_bgr()

            polygon_id = f'polygon_{i}'

            individual_masks[polygon_id] = {
                'binary_mask': binary_mask,
                'colored_mask': colored_mask,
                'class': label,
                'confidence': float(detection.confidence) if hasattr(detection, 'confidence') else 0.0,
                'bbox': detection.xyxy if hasattr(detection, 'xyxy') else [0, 0, 0, 0],
                'color': color
            }

    return individual_masks


def create_transparent_mask(colored_mask, binary_mask):
    """Создание прозрачной версии цветной маски с вырезанным черным фоном."""
    import cv2

    # Создаем RGBA изображение (с альфа-каналом)
    height, width = colored_mask.shape[:2]
    transparent_mask = np.zeros((height, width, 4), dtype=np.uint8)

    # Копируем цветные пиксели
    transparent_mask[:, :, :3] = colored_mask

    # Создаем альфа-канал на основе бинарной маски
    # Где бинарная маска = 255 (белый) - делаем прозрачным (255)
    # Где бинарная маска = 0 (черный) - делаем полностью прозрачным (0)
    transparent_mask[:, :, 3] = binary_mask

    return transparent_mask


def create_individual_masks_from_predictions(predictions, image_path, file_id):
    """Создание individual_masks из predictions для совместимости с save_individual_masks."""
    import cv2
    import numpy as np

    print("🔧 Создаем individual_masks из predictions...")
    print(f"🔍 Тип predictions: {type(predictions)}")
    print(f"🔍 Количество predictions: {len(predictions) if predictions else 0}")

    # Проверяем первые несколько predictions
    if predictions:
        for i, pred in enumerate(predictions[:3]):  # Проверяем первые 3
            print(f"🔍 Prediction {i}: keys={list(pred.keys()) if isinstance(pred, dict) else 'not dict'}")
            if isinstance(pred, dict) and 'class' in pred:
                print(f"   class='{pred['class']}', has_color={('color' in pred)}, color_value={pred.get('color')}")

    # Загружаем изображение для получения размеров
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Не удалось загрузить изображение: {image_path}")
        return {}

    height, width = image.shape[:2]
    individual_masks = {}

    # Получаем цвета полигонов
    polygon_colors = get_polygon_colors()

    for i, prediction in enumerate(predictions):
        print(f"🔍 Обработка prediction {i}: type={type(prediction)}")
        if isinstance(prediction, dict):
            print(f"   keys={list(prediction.keys())}")
            if 'class' in prediction:
                print(f"   class='{prediction['class']}'")
            if 'color' in prediction:
                print(f"   color='{prediction['color']}'")
            else:
                print(f"   ⚠️ Нет поля 'color'!")
            if 'points' in prediction and prediction['points']:
                points = prediction['points']
                print(f"   points_count={len(points)}")
                if len(points) > 0:
                    # Покажем первые координаты
                    first_point = points[0]
                    if isinstance(first_point, dict):
                        print(f"   first_point: x={first_point.get('x')}, y={first_point.get('y')}")
                    elif isinstance(first_point, list):
                        print(f"   first_point: {first_point}")

        # Получаем координаты полигона
        if 'points' in prediction:
            points = prediction['points']
            if len(points) >= 3:  # Минимум 3 точки для полигона
                # Создаем бинарную маску
                binary_mask = np.zeros((height, width), dtype=np.uint8)

                try:
                    # Конвертируем координаты в правильный формат
                    polygon_points = []
                    for point in points:
                        if isinstance(point, dict) and 'x' in point and 'y' in point:
                            # Формат Roboflow: {'x': float, 'y': float}
                            x = float(point['x'])
                            y = float(point['y'])
                            polygon_points.append([x, y])
                        elif isinstance(point, list) and len(point) >= 2:
                            # Формат списка: [x, y]
                            x = float(point[0])
                            y = float(point[1])
                            polygon_points.append([x, y])

                    if len(polygon_points) >= 3:
                        # Убеждаемся, что все координаты - числа, а не строки
                        polygon_points = [[int(float(x)), int(float(y))] for x, y in polygon_points]
                        polygon_points = np.array(polygon_points, dtype=np.int32)
                        cv2.fillPoly(binary_mask, [polygon_points], 255)

                        # Создаем цветную маску
                        colored_mask = np.zeros((height, width, 3), dtype=np.uint8)

                        # Назначаем цвет для класса
                        class_name = prediction.get('class', f'class_{i}')

                        # Получаем цвет из polygon_colors или создаем новый
                        if polygon_colors and class_name in polygon_colors:
                            color = polygon_colors[class_name]
                            color_rgb = color.as_bgr()  # OpenCV использует BGR
                        else:
                            # Создаем цвет на основе хэша
                            import colorsys
                            hue = hash(class_name) % 360
                            rgb = colorsys.hsv_to_rgb(hue / 360, 0.7, 0.8)
                            color_rgb = (int(rgb[2] * 255), int(rgb[1] * 255), int(rgb[0] * 255))  # BGR

                        # Применяем цвет к маске
                        colored_mask[binary_mask == 255] = color_rgb

                        polygon_id = f'polygon_{i}'

                        individual_masks[polygon_id] = {
                            'binary_mask': binary_mask,
                            'colored_mask': colored_mask,
                            'class': class_name,
                            'confidence': float(prediction.get('confidence', 0.0)),
                            'bbox': prediction.get('bbox', [0, 0, 0, 0])
                        }

                except Exception as e:
                    print(f"⚠️ Ошибка при обработке полигона {i}: {e}")
                    continue

    print(f"✅ Создано {len(individual_masks)} individual_masks")
    return individual_masks


def save_individual_masks(individual_masks, file_id, timestamp):
    """Сохранение отдельных масок полигонов с прозрачными версиями."""
    import os
    base_name = f"{file_id}_{timestamp}"

    # Создаем директорию для масок полигонов
    masks_dir = os.path.join("tmp", f"masks_{base_name}")
    os.makedirs(masks_dir, exist_ok=True)

    saved_masks = {}

    for polygon_id, mask_data in individual_masks.items():
        # Сохраняем бинарную маску
        binary_filename = f"{polygon_id}_binary.png"
        binary_path = os.path.join(masks_dir, binary_filename)
        pil_binary = Image.fromarray(mask_data['binary_mask'])
        pil_binary.save(binary_path)

        # Сохраняем цветную маску
        colored_filename = f"{polygon_id}_colored.png"
        colored_path = os.path.join(masks_dir, colored_filename)
        pil_colored = Image.fromarray(mask_data['colored_mask'])
        pil_colored.save(colored_path)

        # Создаем и сохраняем прозрачную версию цветной маски
        transparent_mask = create_transparent_mask(mask_data['colored_mask'], mask_data['binary_mask'])
        transparent_filename = f"{polygon_id}_transparent.png"
        transparent_path = os.path.join(masks_dir, transparent_filename)

        # Сохраняем как PNG с прозрачностью
        pil_transparent = Image.fromarray(transparent_mask, 'RGBA')
        pil_transparent.save(transparent_path, format='PNG')

        print(f"✂️ Создана прозрачная маска: {transparent_path}")

        saved_masks[polygon_id] = {
            'binary': binary_path,
            'colored': colored_path,
            'transparent': transparent_path,
            'class': mask_data['class'],
            'confidence': mask_data['confidence'],
            'bbox': mask_data['bbox'],
            'color': mask_data.get('color') or '#FF6B6B'  # Безопасный доступ с дефолтом
        }

    return saved_masks, masks_dir


def save_multiple_formats(image_array, mask_array, file_id, original_filename,
                        detections=None, labels=None, models_info=None, polygon_colors=None, original_image=None):
    """Сохранение изображения в нескольких форматах с поддержкой отдельных полигонов."""
    import os
    import time

    timestamp = int(time.time())
    base_name = f"{file_id}_{timestamp}"

    # Сохраняем оригинальное изображение с наложенными масками
    overlay_path = os.path.join("tmp", f"overlay_{base_name}.jpg")
    print(f"💾 Сохраняем overlay: {overlay_path}")
    pil_overlay = Image.fromarray(image_array)
    pil_overlay.save(overlay_path)
    print(f"✅ Overlay сохранен: {os.path.exists(overlay_path)}")

    # Сохраняем чистые маски
    mask_path = os.path.join("tmp", f"mask_{base_name}.png")
    print(f"💾 Сохраняем mask: {mask_path}")
    pil_mask = Image.fromarray(mask_array)
    pil_mask.save(mask_path)
    print(f"✅ Mask сохранена: {os.path.exists(mask_path)}")

    # Сохраняем настоящее оригинальное изображение без масок
    original_path = os.path.join("tmp", f"original_{file_id}.jpg")
    print(f"💾 Сохраняем original: {original_path}")
    if original_image is not None:
        # Используем переданное оригинальное изображение
        pil_original = Image.fromarray(original_image)
        pil_original.save(original_path)
        print(f"✅ Original сохранен (из original_image): {os.path.exists(original_path)}")
    else:
        # Fallback: используем overlay (как было раньше)
        pil_overlay.save(original_path)
        print(f"✅ Original сохранен (из overlay): {os.path.exists(original_path)}")

    # Создаем отдельные маски для каждого полигона
    individual_masks = {}
    individual_masks_dir = None

    print(f"🎨 DEBUG: polygon_colors = {polygon_colors}")
    print(f"🎨 DEBUG: models_info keys = {list(models_info.keys()) if models_info else 'None'}")

    # Пытаемся использовать предсказания Roboflow с координатами полигонов
    if models_info and 'predictions' in models_info:
        predictions = models_info['predictions']
        if predictions and original_image is not None and polygon_colors is not None:
            print(f"🎨 Создаем отдельные маски из предсказаний Roboflow для {len(predictions)} полигонов...")
            individual_masks = create_individual_polygon_masks_from_predictions(predictions, original_image.shape, polygon_colors)

            if individual_masks:
                saved_masks, masks_dir = save_individual_masks(individual_masks, file_id, timestamp)
                individual_masks_dir = masks_dir
                print(f"✅ Сохранены отдельные маски из Roboflow: {len(saved_masks)} полигонов в {masks_dir}")
    # Fallback: используем detections если предсказания недоступны
    elif detections is not None and labels is not None and polygon_colors is not None and original_image is not None:
        print(f"🎨 Создаем отдельные маски для {len(detections)} полигонов (fallback)...")
        individual_masks = create_individual_polygon_masks(detections, labels, original_image.shape, polygon_colors)

        if individual_masks:
            saved_masks, masks_dir = save_individual_masks(individual_masks, file_id, timestamp)
            individual_masks_dir = masks_dir
            print(f"✅ Сохранены отдельные маски: {len(saved_masks)} полигонов в {masks_dir}")

    # Получить информацию о детекциях для frontend
    detections_info = []
    polygons_info = []

    # Если у нас есть предсказания Roboflow, используем их для создания информации о полигонах
    if models_info and 'predictions' in models_info:
        predictions = models_info['predictions']
        for i, prediction in enumerate(predictions):
            class_name = prediction.get('class', f'class_{i}')
            confidence = float(prediction.get('confidence', 0.0))

            # Получить координаты полигона (Roboflow format: [x, y, width, height])
            bbox = prediction.get('bbox', [0, 0, 0, 0])
            if len(bbox) >= 4:
                x, y, width, height = bbox
                x1, y1 = x, y
                x2, y2 = x + width, y + height
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                print(f"📦 Roboflow bbox: [{x}, {y}, {width}, {height}] -> center: ({center_x}, {center_y})")
            else:
                x1 = y1 = x2 = y2 = center_x = center_y = 0

            # Получить цвет полигона
            polygon_color = None

            # Сначала пробуем найти цвет по точному совпадению class_name
            if polygon_colors and class_name in polygon_colors:
                color_obj = polygon_colors[class_name]
                print(f"🎨 Найден цвет для {class_name}: {color_obj}")
            else:
                # Если не нашли, пробуем найти по частичному совпадению или создать новый
                print(f"⚠️ Цвет для {class_name} не найден в polygon_colors, генерируем новый")
                print(f"   Доступные цвета: {list(polygon_colors.keys()) if polygon_colors else []}")
                # Создаем временный цвет для этого полигона
                color_obj = assign_color_to_label(class_name, i, {})

            # Конвертируем цвет в hex формат
            try:
                if hasattr(color_obj, 'as_rgb'):
                    r, g, b = color_obj.as_rgb()
                    polygon_color = f'#{int(r):02x}{int(g):02x}{int(b):02x}'
                elif hasattr(color_obj, 'as_bgr'):
                    b, g, r = color_obj.as_bgr()
                    polygon_color = f'#{int(r):02x}{int(g):02x}{int(b):02x}'
                elif hasattr(color_obj, '__iter__') and len(color_obj) >= 3:
                    r, g, b = color_obj[:3]
                    polygon_color = f'#{int(r):02x}{int(g):02x}{int(b):02x}'
                else:
                    print(f"⚠️ Неизвестный формат цвета для {class_name}: {type(color_obj)}")
                    # Генерируем цвет на основе хэша
                    hash_val = hash(class_name) % 360
                    polygon_color = f'hsl({hash_val}, 70%, 50%)'
            except Exception as e:
                print(f"⚠️ Ошибка при конвертации цвета для {class_name}: {e}")
                hash_val = hash(class_name) % 360
                polygon_color = f'hsl({hash_val}, 70%, 50%)'

            print(f"🎨 Финальный цвет для {class_name}: {polygon_color}")

            # Получить цвет для детекции
            detection_color = polygon_color
            if not detection_color:
                # Генерируем цвет по умолчанию
                hash_value = 0
                for char in class_name:
                    hash_value = (hash_value * 31 + ord(char)) & 0xFFFFFFFF
                r = max((hash_value >> 16) & 0xFF, 100)
                g = max((hash_value >> 8) & 0xFF, 100)
                b = max(hash_value & 0xFF, 100)
                detection_color = f'#{r:02x}{g:02x}{b:02x}'

            detections_info.append({
                'id': f'detection_{i}',
                'class': class_name,
                'confidence': confidence,
                'bbox': [float(x1), float(y1), float(x2), float(y2)],
                'center': [float(center_x), float(center_y)],
                'color': detection_color
            })

            # Информация о полигоне для отдельного управления
            polygon_info = {
                'id': f'polygon_{i}',
                'class': class_name,
                'confidence': confidence,
                'bbox': [float(x1), float(y1), float(x2), float(y2)],
                'points': prediction.get('points', []),  # Координаты полигона из Roboflow
                'color': detection_color,
                'visible': True,  # По умолчанию все полигоны видимы
                'binary_mask': individual_masks.get(f'polygon_{i}', {}).get('binary'),
                'colored_mask': individual_masks.get(f'polygon_{i}', {}).get('colored')
            }

            polygons_info.append(polygon_info)
            print(f"🎨 Roboflow полигон {i}: {class_name} -> цвет: {detection_color}")

    # Fallback: используем detections если предсказания недоступны
    if detections is not None and labels is not None:
        for i, detection in enumerate(detections):
            if hasattr(detection, 'xyxy'):
                # Получить координаты bounding box
                x1, y1, x2, y2 = detection.xyxy
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2

                class_name = labels[i] if i < len(labels) else f'class_{i}'
                confidence = float(detection.confidence) if hasattr(detection, 'confidence') else 0.0

                # Получить цвет полигона
                polygon_color = None
                if polygon_colors and class_name in polygon_colors:
                    color_obj = polygon_colors[class_name]
                    try:
                        # Пробуем разные способы получения цвета
                        if hasattr(color_obj, 'as_rgb'):
                            r, g, b = color_obj.as_rgb()
                            polygon_color = f'#{int(r):02x}{int(g):02x}{int(b):02x}'
                        elif hasattr(color_obj, 'as_bgr'):
                            b, g, r = color_obj.as_bgr()
                            polygon_color = f'#{int(r):02x}{int(g):02x}{int(b):02x}'
                        elif hasattr(color_obj, '__iter__') and len(color_obj) >= 3:
                            # Если это tuple/list с RGB значениями
                            r, g, b = color_obj[:3]
                            polygon_color = f'#{int(r):02x}{int(g):02x}{int(b):02x}'
                        else:
                            print(f"⚠️ Неизвестный формат цвета для {class_name}: {type(color_obj)}")
                    except Exception as e:
                        print(f"⚠️ Ошибка при конвертации цвета для {class_name}: {e}")
                        polygon_color = None

                # Получить цвет для детекции
                detection_color = polygon_color
                if not detection_color:
                    # Генерируем цвет по умолчанию
                    hash_value = 0
                    for char in class_name:
                        hash_value = (hash_value * 31 + ord(char)) & 0xFFFFFFFF
                    r = max((hash_value >> 16) & 0xFF, 100)
                    g = max((hash_value >> 8) & 0xFF, 100)
                    b = max(hash_value & 0xFF, 100)
                    detection_color = f'#{r:02x}{g:02x}{b:02x}'

                detections_info.append({
                    'id': f'detection_{i}',
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                    'center': [float(center_x), float(center_y)],
                    'color': detection_color
                })

                # Информация о полигоне для отдельного управления (для detections)
                polygon_info = {
                    'id': f'polygon_{i}',
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': [float(x1), float(y1), float(x2), float(y2)],
                    'points': [],  # Для detections у нас нет точек полигона, только bbox
                    'color': detection_color,
                    'visible': True,  # По умолчанию все полигоны видимы
                    'binary_mask': individual_masks.get(f'polygon_{i}', {}).get('binary'),
                    'colored_mask': individual_masks.get(f'polygon_{i}', {}).get('colored')
                }

                polygons_info.append(polygon_info)
                print(f"🎨 Detection полигон {i}: {class_name} -> цвет: {detection_color}")

    # Информация о моделях для frontend
    models_data = models_info if models_info is not None else {}

    return {
        'overlay': overlay_path,
        'mask': mask_path,
        'original': original_path,
        'filename': original_filename,
        'detections': detections_info,
        'polygons': polygons_info,
        'masks_dir': individual_masks_dir,
        'models_info': models_data
    }