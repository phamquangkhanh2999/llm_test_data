export interface FieldConstraint {
  name: string;
  type: 'string' | 'number' | 'email' | 'card' | 'phone';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  regex?: string;
  allowedValues?: string[];
  description: string;
}

export interface PresetSpec {
  id: string;
  title: string;
  description: string;
  rawText: string;
  fields: FieldConstraint[];
  initialPopulation: Record<string, any>[];
}

export const PRESETS: PresetSpec[] = [
  {
    id: 'user-signup',
    title: 'Đăng ký Tài khoản Người dùng (User Account Sign Up)',
    description: 'Đặc tả chuẩn cho tài khoản đăng ký hệ thống bao gồm: Tên tài khoản, Mật khẩu, Email và Tuổi.',
    rawText: `Yêu cầu hệ thống đăng ký người dùng:
- Username: Bắt buộc, độ dài từ 5 đến 15 ký tự, chỉ chứa chữ và số, không chứa khoảng trắng.
- Password: Bắt buộc, tối thiểu 8 ký tự, tối đa 20 ký tự, cần có chữ thường, chữ hoa, và ký tự đặc biệt.
- Email: Bắt buộc, đúng định dạng email tiêu chuẩn.
- Age: Không bắt buộc, định dạng số nguyên, phải từ 18 đến 100 tuổi.`,
    fields: [
      {
        name: 'username',
        type: 'string',
        required: true,
        minLength: 5,
        maxLength: 15,
        regex: '^[a-zA-Z0-9]+$',
        description: 'Độ dài 5-15 ký tự, chữ và số'
      },
      {
        name: 'password',
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 20,
        regex: '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])',
        description: 'Tối thiểu 8 ký tự, có chữ hoa, thường và số'
      },
      {
        name: 'email',
        type: 'email',
        required: true,
        description: 'Địa chỉ email hợp lệ'
      },
      {
        name: 'age',
        type: 'number',
        required: false,
        minValue: 18,
        maxValue: 100,
        description: 'Số nguyên từ 18 đến 100'
      }
    ],
    initialPopulation: [
      { username: 'alex99', password: 'Password123!', email: 'alex.jones@gmail.com', age: 25 },
      { username: 'sarah_k', password: 'SecurePass9!', email: 'sarah.k@yahoo.com', age: 31 },
      { username: 'john', password: '123', email: 'john@com', age: 15 }, // invalid seed
      { username: 'user1234567890123', password: 'mypassword', email: 'invalid_email.com', age: 105 }, // edge / invalid seed
      { username: 'rootadmin', password: 'SuperUser789#', email: 'admin@company.vn', age: 42 },
      { username: 'guest', password: 'Password@2026', email: 'guest_user@outlook.com', age: 18 }, // boundary age
      { username: 'dev_user', password: 'aB1!cDeFgHiJ', email: 'dev@test.io', age: 100 }, // boundary age
      { username: 'hack\' OR \'1\'=\'1', password: 'inject\' --', email: 'sql@inject.org', age: 29 }, // security seed
      { username: '<script>alert(1)</script>', password: 'XssPassword!', email: 'xss@payload.com', age: 30 } // security seed
    ]
  },
  {
    id: 'payment-gateway',
    title: 'Cổng Thanh toán Hóa đơn (E-Commerce Payment Gateway)',
    description: 'Quy trình thanh toán bằng thẻ tín dụng bao gồm: Số thẻ, Mã bảo mật CVV, Số tiền và Đơn vị tiền tệ.',
    rawText: `Đặc tả kỹ thuật của giao dịch thanh toán:
- Card Number: Bắt buộc, đúng định dạng thẻ tín dụng 16 số.
- CVV: Bắt buộc, là số gồm đúng 3 chữ số (mã bảo mật).
- Amount: Bắt buộc, phải là số dương lớn hơn 0, tối đa 50,000 USD.
- Currency: Bắt buộc, chỉ nhận một trong các giá trị: USD, VND, EUR.`,
    fields: [
      {
        name: 'cardNumber',
        type: 'card',
        required: true,
        regex: '^\\d{16}$',
        description: 'Số thẻ tín dụng gồm 16 chữ số'
      },
      {
        name: 'cvv',
        type: 'string',
        required: true,
        minLength: 3,
        maxLength: 3,
        regex: '^\\d{3}$',
        description: '3 chữ số bảo mật'
      },
      {
        name: 'amount',
        type: 'number',
        required: true,
        minValue: 1,
        maxValue: 50000,
        description: 'Số dương từ 1 đến 50,000'
      },
      {
        name: 'currency',
        type: 'string',
        required: true,
        allowedValues: ['USD', 'VND', 'EUR'],
        description: 'Đơn vị: USD, VND, EUR'
      }
    ],
    initialPopulation: [
      { cardNumber: '4111222233334444', cvv: '123', amount: 150, currency: 'USD' },
      { cardNumber: '5555666677778888', cvv: '999', amount: 2000000, currency: 'VND' }, // invalid amount (too high)
      { cardNumber: '12345', cvv: '99', amount: -50, currency: 'YEN' }, // invalid seed
      { cardNumber: '1111111111111111', cvv: '000', amount: 1, currency: 'USD' }, // boundary seed
      { cardNumber: '9999999999999999', cvv: '999', amount: 50000, currency: 'EUR' }, // boundary seed
      { cardNumber: '4111222233334444\' OR cvv=\'999', cvv: '999', amount: 100, currency: 'USD' } // security seed
    ]
  },
  {
    id: 'vip-member',
    title: 'Đăng ký Thành viên VIP (VIP Member REST API)',
    description: 'Quy trình tạo mới thành viên VIP tích hợp API: Tên đầy đủ, Số điện thoại Việt Nam, Mã giảm giá VIP.',
    rawText: `Mô tả trường dữ liệu API Đăng ký VIP:
- Full Name: Bắt buộc, độ dài từ 2 đến 50 ký tự, không chứa ký tự đặc biệt.
- Phone: Bắt buộc, số điện thoại Việt Nam hợp lệ (bắt đầu bằng 09, 03, 07, 08, 05, gồm 10 chữ số).
- Discount Code: Không bắt buộc, chuỗi chữ và số viết hoa, độ dài tối đa 10 ký tự.`,
    fields: [
      {
        name: 'fullName',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 50,
        regex: '^[a-zA-ZÀ-ỹ ]+$',
        description: 'Họ tên 2-50 ký tự, không chứa ký tự đặc biệt'
      },
      {
        name: 'phone',
        type: 'phone',
        required: true,
        regex: '^(03|05|07|08|09)\\d{8}$',
        description: 'SĐT Việt Nam gồm 10 chữ số'
      },
      {
        name: 'discountCode',
        type: 'string',
        required: false,
        maxLength: 10,
        regex: '^[A-Z0-9]+$',
        description: 'Mã chữ và số viết hoa, tối đa 10 ký tự'
      }
    ],
    initialPopulation: [
      { fullName: 'Nguyễn Văn A', phone: '0912345678', discountCode: 'VIP2026' },
      { fullName: 'Trần Thị B', phone: '0388888888', discountCode: 'PROMO10' },
      { fullName: 'A', phone: '123456', discountCode: 'lowercase' }, // invalid seed
      { fullName: 'Lê Hoàng Cực Dài'.repeat(5), phone: '0999999999', discountCode: 'SUPERLONGCODE123' }, // edge seed
      { fullName: 'Hồ Anh Dũng', phone: '0555555555', discountCode: '' }, // boundary empty code
      { fullName: '<svg/onload=alert(1)>', phone: '0777777777', discountCode: 'XSS' } // security seed
    ]
  }
];

// Mock LLM Parse Function
export async function mockLLMParse(rawText: string): Promise<{ parsedSchema: FieldConstraint[], initialPopulation: Record<string, any>[] }> {
  // Simulate network latency of LLM API
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 1. Try to find a matching preset by simple text matching
  const textLower = rawText.toLowerCase();
  for (const preset of PRESETS) {
    if (textLower.includes(preset.id) || textLower.includes(preset.title.toLowerCase().substring(0, 10)) || textLower.includes('đăng ký') && preset.id === 'user-signup' && textLower.includes('email')) {
      // Create random variations of initial population to simulate fresh LLM responses
      const mutatedSeeds = preset.initialPopulation.map(seed => {
        const copy = { ...seed };
        // Small random tweak to ages or amount if present
        if ('age' in copy && typeof copy.age === 'number' && copy.age < 100 && copy.age > 18) {
          copy.age += Math.floor(Math.random() * 5) - 2;
        }
        if ('amount' in copy && typeof copy.amount === 'number' && copy.amount < 1000) {
          copy.amount += Math.floor(Math.random() * 20) - 10;
        }
        return copy;
      });

      return {
        parsedSchema: preset.fields,
        initialPopulation: mutatedSeeds
      };
    }
  }

  // 2. Fallback: Parse dynamically using naive keyword extraction (giving the LLM parser a "smart" fallback)
  const fields: FieldConstraint[] = [];
  
  if (textLower.includes('username') || textLower.includes('tên') || textLower.includes('user')) {
    fields.push({
      name: 'username',
      type: 'string',
      required: true,
      minLength: 5,
      maxLength: 12,
      regex: '^[a-z0-9]+$',
      description: 'Độ dài 5-12, chữ thường và số (Tự động nhận diện)'
    });
  }

  if (textLower.includes('password') || textLower.includes('mật khẩu') || textLower.includes('pass')) {
    fields.push({
      name: 'password',
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 16,
      description: 'Mật khẩu từ 6-16 ký tự (Tự động nhận diện)'
    });
  }

  if (textLower.includes('email') || textLower.includes('thư điện tử')) {
    fields.push({
      name: 'email',
      type: 'email',
      required: true,
      description: 'Email hợp lệ (Tự động nhận diện)'
    });
  }

  if (textLower.includes('tuổi') || textLower.includes('age') || textLower.includes('số')) {
    fields.push({
      name: 'score',
      type: 'number',
      required: false,
      minValue: 0,
      maxValue: 100,
      description: 'Số nguyên từ 0 đến 100 (Tự động nhận diện)'
    });
  }

  // If no fields could be identified, create a default simple schema
  if (fields.length === 0) {
    fields.push({
      name: 'inputText',
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 30,
      description: 'Dữ liệu văn bản 3-30 ký tự (Default)'
    });
  }

  // Synthesize dynamic F0 seeds
  const initialPopulation: Record<string, any>[] = [];
  const testNames = ['admin', 'guest', 'member', 'mod', 'super_user'];
  
  for (let i = 0; i < 8; i++) {
    const record: Record<string, any> = {};
    fields.forEach(f => {
      if (f.type === 'string') {
        record[f.name] = `${testNames[i % testNames.length]}${Math.floor(Math.random() * 90) + 10}`;
      } else if (f.type === 'email') {
        record[f.name] = `user${i}@domain.com`;
      } else if (f.type === 'number') {
        record[f.name] = Math.floor(Math.random() * 80) + 18;
      } else {
        record[f.name] = 'val123';
      }
    });
    initialPopulation.push(record);
  }

  // Inject a security XSS seed
  const secRecord: Record<string, any> = {};
  fields.forEach(f => {
    if (f.type === 'string') {
      secRecord[f.name] = `<script>alert('${f.name}')</script>`;
    } else if (f.type === 'email') {
      secRecord[f.name] = 'xss@inject.org';
    } else {
      secRecord[f.name] = 0;
    }
  });
  initialPopulation.push(secRecord);

  return {
    parsedSchema: fields,
    initialPopulation
  };
}
