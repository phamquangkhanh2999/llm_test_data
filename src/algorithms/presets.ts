export interface FieldConstraint {
  name: string;
  type: 'string' | 'number' | 'email' | 'card' | 'phone' | 'boolean';
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
    id: "preset-0",
    title: "Đăng ký tài khoản",
    description: "Đặc tả Đăng ký tài khoản từ dữ liệu mẫu.",
    rawText: "Đăng ký tài khoản:\n- fullName: bắt buộc, không được rỗng, tối đa 70 ký tự, chỉ chứa chữ/số/khoảng trắng, không chứa script hoặc SQL injection.\n- email: bắt buộc, không được rỗng, tối đa 40 ký tự, đúng định dạng email, không trùng email đã tồn tại, không chứa dữ liệu nguy hiểm.\n- password: bắt buộc, dài 8–16 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt.\n- phone: bắt buộc, tối đa 10 ký tự, chỉ chứa chữ số, không chứa chữ cái hoặc ký tự đặc biệt.\n- address: không bắt buộc, tối đa 191 ký tự, không chứa script, HTML nguy hiểm hoặc SQL injection.",
    fields: [
      {
        name: "fullName",
        type: "string",
        required: true,
        description: "bắt buộc, không được rỗng, tối đa 70 ký tự, chỉ chứa chữ/số/khoảng trắng, không chứa script hoặc SQL injection."
      },
      {
        name: "email",
        type: "email",
        required: true,
        description: "bắt buộc, không được rỗng, tối đa 40 ký tự, đúng định dạng email, không trùng email đã tồn tại, không chứa dữ liệu nguy hiểm."
      },
      {
        name: "password",
        type: "string",
        required: true,
        description: "bắt buộc, dài 8–16 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt."
      },
      {
        name: "phone",
        type: "string",
        required: true,
        description: "bắt buộc, tối đa 10 ký tự, chỉ chứa chữ số, không chứa chữ cái hoặc ký tự đặc biệt."
      },
      {
        name: "address",
        type: "string",
        required: false,
        description: "không bắt buộc, tối đa 191 ký tự, không chứa script, HTML nguy hiểm hoặc SQL injection."
      }
    ],
    initialPopulation: [
      {
        fullName: "Test1",
        email: "test1@gmail.com",
        password: "Test1",
        phone: "Test1",
        address: "Test1"
      },
      {
        fullName: "Test2",
        email: "test2@gmail.com",
        password: "Test2",
        phone: "Test2",
        address: "Test2"
      }
    ]
  },
  {
    id: "preset-1",
    title: "Đăng nhập",
    description: "Đặc tả Đăng nhập từ dữ liệu mẫu.",
    rawText: "Đăng nhập:\n- email: bắt buộc, không được rỗng, đúng định dạng email, tối đa 40 ký tự, phải tồn tại trong hệ thống.\n- password: bắt buộc, không được rỗng, phải khớp với tài khoản tương ứng.\n- rememberMe: không bắt buộc, nếu có thì chỉ nhận TRUE hoặc FALSE.",
    fields: [
      {
        name: "email",
        type: "email",
        required: true,
        description: "bắt buộc, không được rỗng, đúng định dạng email, tối đa 40 ký tự, phải tồn tại trong hệ thống."
      },
      {
        name: "password",
        type: "string",
        required: true,
        description: "bắt buộc, không được rỗng, phải khớp với tài khoản tương ứng."
      },
      {
        name: "rememberMe",
        type: "boolean",
        required: false,
        description: "không bắt buộc, nếu có thì chỉ nhận TRUE hoặc FALSE."
      }
    ],
    initialPopulation: [
      {
        email: "test1@gmail.com",
        password: "Test1",
        rememberMe: true
      },
      {
        email: "test2@gmail.com",
        password: "Test2",
        rememberMe: false
      }
    ]
  },
  {
    id: "preset-2",
    title: "Thêm sản phẩm",
    description: "Đặc tả Thêm sản phẩm từ dữ liệu mẫu.",
    rawText: "Thêm sản phẩm:\n- productName: bắt buộc, không được rỗng, là tên sản phẩm hợp lệ, không chứa script hoặc SQL injection.\n- sku: bắt buộc, không được rỗng, dùng để định danh sản phẩm, không chứa dữ liệu nguy hiểm.\n- price: bắt buộc, phải là số, lớn hơn 0, không nhận số âm, số 0 hoặc chuỗi như “150k”.\n- stockQuantity: bắt buộc, phải là số nguyên, lớn hơn hoặc bằng 0, không nhận số âm, số thập phân hoặc chữ.\n- categoryId: bắt buộc, phải thuộc danh mục hợp lệ, ví dụ CAT-01 đến CAT-05.\n- imageUrl: không bắt buộc, nếu nhập thì phải là đường dẫn ảnh hợp lệ và an toàn.\n- status: bắt buộc, chỉ nhận ACTIVE, INACTIVE hoặc OUT_OF_STOCK.\n- description: không bắt buộc, không chứa script, HTML nguy hiểm hoặc SQL injection.",
    fields: [
      {
        name: "productName",
        type: "string",
        required: true,
        description: "bắt buộc, không được rỗng, là tên sản phẩm hợp lệ, không chứa script hoặc SQL injection."
      },
      {
        name: "sku",
        type: "string",
        required: true,
        description: "bắt buộc, không được rỗng, dùng để định danh sản phẩm, không chứa dữ liệu nguy hiểm."
      },
      {
        name: "price",
        type: "number",
        required: true,
        description: "bắt buộc, phải là số, lớn hơn 0, không nhận số âm, số 0 hoặc chuỗi như “150k”."
      },
      {
        name: "stockQuantity",
        type: "number",
        required: true,
        description: "bắt buộc, phải là số nguyên, lớn hơn hoặc bằng 0, không nhận số âm, số thập phân hoặc chữ."
      },
      {
        name: "categoryId",
        type: "string",
        required: true,
        description: "bắt buộc, phải thuộc danh mục hợp lệ, ví dụ CAT-01 đến CAT-05."
      },
      {
        name: "imageUrl",
        type: "string",
        required: false,
        description: "không bắt buộc, nếu nhập thì phải là đường dẫn ảnh hợp lệ và an toàn."
      },
      {
        name: "status",
        type: "string",
        required: true,
        description: "bắt buộc, chỉ nhận ACTIVE, INACTIVE hoặc OUT_OF_STOCK."
      },
      {
        name: "description",
        type: "string",
        required: false,
        description: "không bắt buộc, không chứa script, HTML nguy hiểm hoặc SQL injection."
      }
    ],
    initialPopulation: [
      {
        productName: "Test1",
        sku: "Test1",
        price: 10,
        stockQuantity: 10,
        categoryId: "Test1",
        imageUrl: "Test1",
        status: "Test1",
        description: "Test1"
      },
      {
        productName: "Test2",
        sku: "Test2",
        price: 100,
        stockQuantity: 100,
        categoryId: "Test2",
        imageUrl: "Test2",
        status: "Test2",
        description: "Test2"
      }
    ]
  },
  {
    id: "preset-3",
    title: "Sửa sản phẩm",
    description: "Đặc tả Sửa sản phẩm từ dữ liệu mẫu.",
    rawText: "Sửa sản phẩm:\n- productId: bắt buộc, không được rỗng, đúng định dạng ID, ví dụ PROD-0001, và phải tồn tại trong hệ thống.\n- productName: có thể cập nhật, nếu nhập thì không được rỗng, không chứa script hoặc SQL injection.\n- sku: có thể cập nhật, nếu nhập thì không được rỗng, không chứa dữ liệu nguy hiểm.\n- price: có thể cập nhật, nếu nhập thì phải là số, lớn hơn 0, không nhận chuỗi như “250000đ”.\n- stockQuantity: có thể cập nhật, nếu nhập thì phải là số nguyên, lớn hơn hoặc bằng 0.\n- categoryId: có thể cập nhật, nếu nhập thì phải thuộc danh mục hợp lệ.\n- status: có thể cập nhật, chỉ nhận ACTIVE, INACTIVE hoặc OUT_OF_STOCK.\n- description: không bắt buộc, không chứa script, HTML nguy hiểm hoặc SQL injection.",
    fields: [
      {
        name: "productId",
        type: "string",
        required: true,
        description: "bắt buộc, không được rỗng, đúng định dạng ID, ví dụ PROD-0001, và phải tồn tại trong hệ thống."
      },
      {
        name: "productName",
        type: "string",
        required: false,
        description: "có thể cập nhật, nếu nhập thì không được rỗng, không chứa script hoặc SQL injection."
      },
      {
        name: "sku",
        type: "string",
        required: false,
        description: "có thể cập nhật, nếu nhập thì không được rỗng, không chứa dữ liệu nguy hiểm."
      },
      {
        name: "price",
        type: "number",
        required: false,
        description: "có thể cập nhật, nếu nhập thì phải là số, lớn hơn 0, không nhận chuỗi như “250000đ”."
      },
      {
        name: "stockQuantity",
        type: "number",
        required: false,
        description: "có thể cập nhật, nếu nhập thì phải là số nguyên, lớn hơn hoặc bằng 0."
      },
      {
        name: "categoryId",
        type: "string",
        required: false,
        description: "có thể cập nhật, nếu nhập thì phải thuộc danh mục hợp lệ."
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: "có thể cập nhật, chỉ nhận ACTIVE, INACTIVE hoặc OUT_OF_STOCK."
      },
      {
        name: "description",
        type: "string",
        required: false,
        description: "không bắt buộc, không chứa script, HTML nguy hiểm hoặc SQL injection."
      }
    ],
    initialPopulation: [
      {
        productId: "Test1",
        productName: "Test1",
        sku: "Test1",
        price: 10,
        stockQuantity: 10,
        categoryId: "Test1",
        status: "Test1",
        description: "Test1"
      },
      {
        productId: "Test2",
        productName: "Test2",
        sku: "Test2",
        price: 100,
        stockQuantity: 100,
        categoryId: "Test2",
        status: "Test2",
        description: "Test2"
      }
    ]
  },
  {
    id: "preset-4",
    title: "Xóa sản phẩm",
    description: "Đặc tả Xóa sản phẩm từ dữ liệu mẫu.",
    rawText: "Xóa sản phẩm:\n- productId: bắt buộc, không được rỗng, đúng định dạng ID, ví dụ PROD-0001, và phải tồn tại trong hệ thống.\n- confirmDelete: bắt buộc, chỉ cho phép xóa khi giá trị là TRUE.\n- deleteMode: bắt buộc, trong phạm vi kiểm thử chỉ chấp nhận SOFT_DELETE.\n- reason: không bắt buộc, nếu nhập thì không chứa script hoặc SQL injection.\n- ràng buộc nghiệp vụ: không xóa sản phẩm nếu đang liên kết với đơn hàng hoặc dữ liệu nghiệp vụ quan trọng.",
    fields: [
      {
        name: "productId",
        type: "string",
        required: true,
        description: "bắt buộc, không được rỗng, đúng định dạng ID, ví dụ PROD-0001, và phải tồn tại trong hệ thống."
      },
      {
        name: "confirmDelete",
        type: "boolean",
        required: true,
        description: "bắt buộc, chỉ cho phép xóa khi giá trị là TRUE."
      },
      {
        name: "deleteMode",
        type: "string",
        required: true,
        description: "bắt buộc, trong phạm vi kiểm thử chỉ chấp nhận SOFT_DELETE."
      },
      {
        name: "reason",
        type: "string",
        required: false,
        description: "không bắt buộc, nếu nhập thì không chứa script hoặc SQL injection."
      }
    ],
    initialPopulation: [
      {
        productId: "Test1",
        confirmDelete: true,
        deleteMode: "Test1",
        reason: "Test1"
      },
      {
        productId: "Test2",
        confirmDelete: false,
        deleteMode: "Test2",
        reason: "Test2"
      }
    ]
  },
  {
    id: "preset-5",
    title: "Tìm kiếm sản phẩm",
    description: "Đặc tả Tìm kiếm sản phẩm từ dữ liệu mẫu.",
    rawText: "Tìm kiếm sản phẩm:\n- keyword: không bắt buộc, có thể để trống, nếu nhập thì không chứa script hoặc SQL injection.\n- categoryId: không bắt buộc, nếu nhập thì phải thuộc danh mục hợp lệ.\n- minPrice: không bắt buộc, nếu nhập thì phải là số và lớn hơn hoặc bằng 0.\n- maxPrice: không bắt buộc, nếu nhập thì phải là số, lớn hơn hoặc bằng 0 và lớn hơn hoặc bằng minPrice.\n- status: không bắt buộc, nếu nhập thì chỉ nhận ACTIVE, INACTIVE hoặc OUT_OF_STOCK.\n- sortBy: dùng để sắp xếp, chỉ nhận price, name, createdAt, updatedAt hoặc productName.\n- sortDirection: chỉ nhận ASC hoặc DESC.\n- page: bắt buộc khi phân trang, phải là số nguyên và lớn hơn hoặc bằng 1.\n- pageSize: bắt buộc khi phân trang, phải là số nguyên từ 1 đến 100.",
    fields: [
      {
        name: "keyword",
        type: "string",
        required: false,
        description: "không bắt buộc, có thể để trống, nếu nhập thì không chứa script hoặc SQL injection."
      },
      {
        name: "categoryId",
        type: "string",
        required: false,
        description: "không bắt buộc, nếu nhập thì phải thuộc danh mục hợp lệ."
      },
      {
        name: "minPrice",
        type: "number",
        required: false,
        description: "không bắt buộc, nếu nhập thì phải là số và lớn hơn hoặc bằng 0."
      },
      {
        name: "maxPrice",
        type: "number",
        required: false,
        description: "không bắt buộc, nếu nhập thì phải là số, lớn hơn hoặc bằng 0 và lớn hơn hoặc bằng minPrice."
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: "không bắt buộc, nếu nhập thì chỉ nhận ACTIVE, INACTIVE hoặc OUT_OF_STOCK."
      },
      {
        name: "sortBy",
        type: "string",
        required: false,
        description: "dùng để sắp xếp, chỉ nhận price, name, createdAt, updatedAt hoặc productName."
      },
      {
        name: "sortDirection",
        type: "string",
        required: false,
        description: "chỉ nhận ASC hoặc DESC."
      },
      {
        name: "page",
        type: "number",
        required: true,
        description: "bắt buộc khi phân trang, phải là số nguyên và lớn hơn hoặc bằng 1."
      },
      {
        name: "pageSize",
        type: "number",
        required: true,
        description: "bắt buộc khi phân trang, phải là số nguyên từ 1 đến 100."
      }
    ],
    initialPopulation: [
      {
        keyword: "Test1",
        categoryId: "Test1",
        minPrice: 10,
        maxPrice: 10,
        status: "Test1",
        sortBy: "Test1",
        sortDirection: "Test1",
        page: 10,
        pageSize: 10
      },
      {
        keyword: "Test2",
        categoryId: "Test2",
        minPrice: 100,
        maxPrice: 100,
        status: "Test2",
        sortBy: "Test2",
        sortDirection: "Test2",
        page: 100,
        pageSize: 100
      }
    ]
  }
];

// Mock LLM Parse Function
export async function mockLLMParse(rawText: string): Promise<{ parsedSchema: FieldConstraint[], initialPopulation: Record<string, any>[] }> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const textLower = rawText.toLowerCase();
  for (const preset of PRESETS) {
    if (textLower.includes(preset.title.toLowerCase().substring(0, 10))) {
      return { parsedSchema: preset.fields, initialPopulation: preset.initialPopulation };
    }
  }
  return { parsedSchema: PRESETS[0].fields, initialPopulation: PRESETS[0].initialPopulation };
}
