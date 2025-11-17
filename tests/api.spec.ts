import { test, expect, request, APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

const DEFAULT_SELLER_ID = 214988;

test.describe('Avito API Tests', () => {
  let apiContext: APIRequestContext;
  let sellerId: number;

  test.beforeEach(async () => {
    // Получаем объект конфигурации
    const config = test.info().project.use;
    // Получаем baseURL из конфигурации
    const baseURL = config.baseURL;

    apiContext = await request.newContext({ baseURL: baseURL });
    sellerId = DEFAULT_SELLER_ID;
  });

  function generateItemData(sellerId?: number) {
    return {
      sellerId: sellerId ?? DEFAULT_SELLER_ID,
      name: `Test Item ${faker.commerce.productName()} ${faker.number.int({ min: 0, max: 1000 })}`,
      price: parseInt(faker.commerce.price({ min: 100, max: 5000 })),
      statistics: {
        likes: faker.number.int({ min: 0, max: 1000 }),
        viewCount: faker.number.int({ min: 0, max: 5000 }),
        contacts: faker.number.int({ min: 0, max: 100 })
      }
    };
  }

  test('TC1: Успешное создание объявления с валидными данными', async () => {
    const itemData = generateItemData();

    const response = await apiContext.post('/api/1/item', {
      data: itemData
    });

    expect(response.status()).toBe(200); // Должен быть 201, как успешно созданный

    const responseData = await response.json();

    expect(responseData).toHaveProperty('status');
    expect(responseData.status).toContain('Сохранили объявление');
  });

  test('TC2: Создание объявления с невалидным seller_id (меньше диапазона)', async () => {
    const itemData = generateItemData();
    itemData.sellerId = 10; // Ниже допустимого диапазона

    const response = await apiContext.post('/api/1/item', {
      data: itemData
    });

    // Ожидаем что будет ошибка так-как seller id ниже диапазона. (в диапазоне 111111-999999)
    expect(response.status()).toBe(400);
  });

  test('TC3: Создание объявления с невалидным seller_id (больше диапазона)', async () => {
    const itemData = generateItemData();
    itemData.sellerId = 999999999999999; // Выше допустимого диапазона

    const response = await apiContext.post('/api/1/item', {
      data: itemData
    });

    // Ожидаем что будет ошибка так-как seller id выше диапазона. (в диапазоне 111111-999999)
    expect(response.status()).toBe(400);
  });

  test('TC4: Создание объявления без обязательных полей', async () => {
    const itemData = generateItemData();
    itemData.name = ""; // Удаляем обязательное поле

    const response = await apiContext.post('/api/1/item', {
      data: itemData
    });

    expect(response.status()).toBe(400);
  });

  test('TC5: Успешное получение существующего объявления', async () => {
    // Сначала создаем объявление
    const itemData = generateItemData();
    const createResponse = await apiContext.post('/api/1/item', { data: itemData });
    const responseText = await createResponse.text();
    const match = responseText.match(/Сохранили объявление - ([a-f0-9-]+)/); // Регулярное выражение
    expect(match).toBeTruthy(); // Значение есть и не null
    const itemId = match![1]; // Гарантируем извлечение

    // Получаем созданное объявление
    const response = await apiContext.get(`/api/1/item/${itemId}`);

    expect(response.status()).toBe(200); // Проверяем 200 код
    const createdItem = await response.json(); // Переводим ответ в JSON формат

    // Объявление создано и получено, но ответ приходит в виде массива, что является ошибкой
    // Поскольку по ID объявления не может быть массива данных, а только одно объявление
    expect(createdItem).toHaveProperty('id', itemId);

    // Так сработает
    // expect(createdItem[0]).toHaveProperty('id', itemId);
  });

  test('TC6: Получение несуществующего объявления', async () => {
    const itemId = '1b025e10-832f-4475-9b3a-dcc773533b3a';
    const response = await apiContext.get(`/api/1/item/${itemId}`);
    expect(response.status()).toBe(404);

    // Можно также проверять поле status из тела ответа, но четких требований к этому не было
    // Поэтому обойдемся только кодом ответа
  });

  test('TC7: Получение объявления с невалидным ID', async () => {
    const response = await apiContext.get('/api/1/item/invalid_id');
    expect(response.status()).toBe(400);
  });

  test('TC8: Успешное получение объявлений существующего продавца', async () => {

    // Создаем два объявления для одного продавца
    const itemData1 = generateItemData(sellerId);
    const itemData2 = generateItemData(sellerId);

    const response1 = await apiContext.post('/api/1/item', {
      data: itemData1
    });

    const response2 = await apiContext.post('/api/1/item', {
      data: itemData2
    });

    // Получаем все объявления продавца
    const sellerResponse = await apiContext.get(`/api/1/${sellerId}/item?=${sellerId}`);
    expect(sellerResponse.status()).toBe(200);

    const items = await sellerResponse.json();
    expect(Array.isArray(items)).toBeTruthy();

    // Проверяем, что все объявления принадлежат указанному seller_id
    items.forEach((item: { sellerId: any; }) => {
      expect(item.sellerId).toBe(sellerId);
    });
  });

  test('TC9: Получение объявлений несуществующего продавца', async () => {

    const unregistredSellerId = 756678;
    const response = await apiContext.get(`/api/1/${unregistredSellerId}/item?=${unregistredSellerId}`);

    // Ожидаем код 404
    expect(response.status()).toBe(404);
  });

  test('TC10: Получение объявлений с невалидным seller_id', async () => {
    const invalidSellerId = 'invalid_id';
    const response = await apiContext.get(`/api/1/${invalidSellerId}/item?=${invalidSellerId}`);
    expect(response.status()).toBe(400);
  });

  test('TC11: Успешное получение статистики существующего объявления', async () => {
    // Создаем объявление
    const itemData = generateItemData();
    const createResponse = await apiContext.post('/api/1/item', {
      data: itemData
    });

    // Получаем статистику
    const statsResponse = await apiContext.get(`/api/2/statistic/8b025e10-832f-4475-9b3a-dcc773533b3a`);

    const statsItem = await statsResponse.json();

    // Проверяем код 200
    expect(statsResponse.status()).toBe(200);
    // Проверяем одно любое поле из статистики
    expect(statsResponse.body()).toHaveProperty('contacts');
    // Так сработает, но статистика не должна быть в формате массива
    // expect(statsItem[0]).toHaveProperty('contacts');
  });

  test('TC12: Получение статистики несуществующего объявления', async () => {
    const invalidAdId = '1b025e10-832f-4475-9b3a-dcc773533b3a';
    const response = await apiContext.get(`/api/2/statistic/${invalidAdId}`);
    expect(response.status()).toBe(404);
  });
});