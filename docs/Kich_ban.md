**XÂY DỰNG VÀ PHÁT TRIỂN HỆ THỐNG BÁN HÀNG THỜI TRANG** 

**Kịch bản** 

## **Kịch bản 1: đăng ký làm khách hàng bán lẻ**

1.1.1.a. Vai trò

Chức năng “Đăng ký” cho phép người dùng tạo tài khoản mới trên hệ thống.

\=\> Chức năng “Đăng ký” cho phép người dùng chưa có tài khoản trên hệ thống muốn đăng ký làm cộng tác viên của đơn vị 

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Kiểm tra khả năng đăng ký tài khoản mới, đảm bảo tính hợp lệ của dữ liệu đầu vào và tính ổn định của hệ thống.  
\-        Đối tượng áp dụng: Khách hàng mới chưa có tài khoản.

a. Mô tả màn hình chức năng

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Họ tên | varchar(191) | Input | N/A | Trường bắt buộc phải nhập, mapping với trường name. Nếu bỏ trống trường họ tên thông báo lỗi “Bạn chưa nhập vào họ tên”. |
| 2 | Email | varchar(191) | Input | N/A | Trường bắt buộc phải nhập để người dùng nhận được link gửi lại mật khẩu, mapping với trường email. Nếu nhập sai email hoặc email chưa có trong dữ liệu hệ thống thì sẽ có thông báo lỗi như hình thông báo lỗi (1) |
| 3 | Mật khẩu | varchar(191) | Input | N/A | Trường bắt buộc phải nhập, mapping với trường password. Mật khẩu phải có từ 8 \- 16 ký tự và bao gồm chữ viết hoa, chữ viết thường, có số và ký tự đặc biệt. Mapping với trường password. Nếu bỏ trống trường mật khẩu hiển thị thông báo lỗi như hình thông báo lỗi (1). |
| 4 | Nhập lại mật khẩu | varchar(191) | Input | N/A | Trường bắt buộc phải nhập, nếu bỏ trống trường nhập lại mật khẩu hiển thị thông báo lỗi như hình thông báo lỗi đăng ký (1). |
| 5 | Số điện thoại | varchar(20) | Input | N/A | Trường bắt buộc nhập, mapping với trường phone. Nếu bỏ trống trường số điện thoại hiển thị thông báo lỗi “Bạn chưa nhập vào mật khẩu” như hình thông báo lỗi đăng ký (1). |
| 6 | Địa chỉ | varchar(191) | Input | N/A | Trường không bắt buộc nhập, mapping với trường address. |
| 7 | Nút “Đăng ký ngay” |  | Input | N/A | Nút “Đăng ký ngay” để gửi đăng ký tài khoản làm khách hàng. |

## **Kịch bản 2: khách hàng lẻ đăng ký làm cộng tác viên**

1.1.1.a. Vai trò

Hỗ trợ người khách hàng lẻ có nhu cầu muốn đăng ký trở thành cộng tác viên.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Cung cấp quy trình đăng ký rõ ràng cho khách hàng lẻ muốn trở thành cộng tác viên, giúp hệ thống quản lý và xét duyệt dễ dàng hơn.  
\-        Đối tượng sử dụng: Áp dụng cho tất cả khách hàng cá nhân chưa có tài khoản cộng tác viên nhưng muốn tham gia hệ thống để hưởng các quyền lợi đặc biệt.

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Tài khoản của tôi | Button | Intput | N/A | Điều hướng link đến trang thông tin tài khoản cá nhân. |
| 2 | Đổi mật khẩu | Button | Intput | N/A | Điều hướng link đến trang đổi mật khẩu. |
| 3 | Đăng ký cộng tác viên | Button | Intput | N/A | Điều hướng link đến trang cho khách lẻ đăng ký làm cộng tác viên. |
| 4 | Đơn hàng | Button | Intput | N/A | Điều hướng link đến trang danh sách các đơn hàng. |
| 5 | Đăng xuất | Button | Intput | N/A | Kích chọn để đăng xuất khỏi hệ thống. |
| 6 | Email | varchar (191) | Output | Lấy từ tài khoản đăng nhập. | Địa chỉ email của khách hàng. |
| 7 | Họ tên | varchar (191) | Output | Lấy từ tài khoản đăng nhập. | Họ tên của khách hàng. |
| 8 | Số điện thoại | varchar (20) | Output | Lấy từ tài khoản đăng nhập. | Số điện thoại của khách hàng. |
| 9 | Địa chỉ |       	varchar(191) | Input | N/A | Địa chỉ là trường không bắt buộc nhập. |
| 10 | Mã giới thiệu | varchar(20) | Input | N/A | Mã giới thiệu là trường không bắt buộc nhập, mapping với trường referral\_by trong cơ sở dữ liệu. |
| 11 | Số đơn hàng tối thiểu/ Tháng | varchar(255) | Input | N/A | Số đơn hàng tối thiểu là trường bắt buộc phải nhập. Nếu bỏ trống thông báo lỗi. |
| 12 | Tổng chi tiêu trên tháng | varchar(255) | Input | N/A | Là trường bắt buộc phải nhập nếu không nhập sẽ thông báo lỗi. |
| 13 | Ngày sinh | Date(12) | Input | N/A | Là trường bắt buộc phải nhập nếu không nhập sẽ thông báo lỗi. |
| 14 | Đăng ký | Button | Input | N/A | Nút “Đăng ký” để gửi đăng ký tài khoản làm cộng tác viên. |

## **Kịch bản 3: quên mật khẩu** 

1.1.1.a. Vai trò

Hỗ trợ người dùng lấy lại quyền truy cập vào hệ thống khi họ quên mật khẩu, giúp duy trì bảo mật và đảm bảo chỉ những người có thẩm quyền mới có thể khôi phục lại tài khoản.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Cho phép người dùng đặt lại mật khẩu khi quên mật khẩu, cung cấp phương thức bảo mật để xác thực danh tính trước khi cấp quyền đặt lại mật khẩu.  
\-        Đối tượng áp dụng: khách hàng.

a. Mô tả màn hình chức năng

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Email | varchar(191) | Input | N/A | Trường bắt buộc phải nhập để người dùng nhận được link gửi lại mật khẩu, mapping với trường email. Nếu sai email hoặc email chưa có trong hệ thống thì sẽ có thông báo lỗi như hình. |
| 2 | Nút “Gửi link lấy lại mật khẩu” | N/A | Input | N/A | Nút “Gửi link lấy lại mật khẩu” để yêu cầu gửi email đặt lại mật khẩu mới. |
| 3 | Nút “Thay đổi mật khẩu” | N/A | Output | N/A | Liên kết để chuyển về trang “Lấy lại mật khẩu”. |

## **Kịch bản 4: đổi mật khẩu**

1.1.1.a. Vai trò

	Giúp đảm bảo tính bảo mật cho hệ thống, cho phép người dùng thay đổi mật khẩu nhằm bảo vệ dữ liệu quan trọng và tránh các rủi ro bảo mật.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Cung cấp cơ chế an toàn cho người dùng đặt lại mật khẩu khi cần, ngăn chặn truy cập trái phép bằng cách đảm bảo chỉ người có quyền mới có thể đặt lại mật khẩu.  
\-        Đối tượng áp dụng: Nhân viên công ty, quản trị viên.

a. Mô tả màn hình chức năng

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Email | varchar(191) | Output | Giá trị từ link lấy lại mật khẩu | Email của người dùng đã được điền sẵn, không cho phép chỉnh sửa và mapping với trường email. |
| 2 | Mật khẩu mới | varchar(191) | Input | N/A | Người dùng nhập mật khẩu mới tại trường này, không được phép bỏ trống trường này, mật khẩu phải có từ 8 \- 16 ký tự và bao gồm chữ viết hoa, chữ viết thường, có số và ký tự đặc biệt. Nếu nhập sai định dạng mật khẩu sẽ có thông báo lỗi như hình thông báo lỗi. |
| 3 | Xác nhận mật khẩu | varchar(191) | Input | N/A | Người dùng nhập lại mật khẩu để xác nhận và kiểm tra trùng khớp với trường “Mật khẩu mới”. Nếu nhập sai hoặc bỏ trống trường thông tin sẽ hiển thị thông báo lỗi. |
| 4 | Nút “Đặt lại mật khẩu” | Button | Input | N/A | Khi bấm hệ thống sẽ cập nhật lại trường password  và chuyển hướng người dùng quay về trang đăng nhập. |
| 5 | Quay lại trang đăng nhập | Link | Output | N/A | Liên kết để chuyển về trang “Đăng nhập” . |

## **Kịch bản 5: Trang chi tiết sản phẩm**

Cung cấp thông tin chi tiết về sản phẩm mà khách hàng hoặc cộng tác viên đã lựa chọn

1.1.1.a. Mục đích và đối tượng áp dụng

\-        Mục đích: Giúp khách hàng xem danh sách sản phẩm hiện có  
\-        Đối tượng áp dụng: Khách hàng lẻ, Cộng tác viên

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Tên sản phẩm  | Varchar (255) | Output | Theo dữ liệu sản phẩm | Tên sản phẩm. |
| 2 | Đánh giá sản phẩm | Int (11) | Output | 0 \- 5  | Tổng số điểm đánh giá của sản phẩm được thể hiện dưới dạng đánh giá sao. |
| 3 | Mã sản phẩm  | Varchar (191) | Output | Theo dữ liệu sản phẩm | Mã định dạng sản phẩm. |
| 4 | Tình trạng hàng   | Int (11) | Output | Theo dữ liệu sản phẩm | Hiển thị số lượng sản phẩm còn trong kho hoặc số lượng biến thể sản phẩm còn trong kho. |
| 5 | Giá sản phẩm  | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Giá bán của sản phẩm. |
| 6 | Tiết kiệm  | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Số tiền và phần trăm giảm giá nếu có. |
| 7 | Thuộc tính sản phẩm (nếu có) | Text | Output | Theo dữ liệu sản phẩm | Thuộc tính sản phẩm (nếu có). |
| 8 | Số lượng | Int (11) | Input | N/A | Người dùng chọn hoặc nhập số lượng sản phẩm muốn mua hoặc thêm vào giỏ hàng. |
| 9 | Nút "Mua Ngay" | Button | Input | N/A | Khi chọn sẽ dẫn đến trang đặt hàng, nếu người dùng không chọn hoặc nhập số lượng thì sẽ mặc định là 1\. |
| 10 | Nút "Giỏ Hàng" | Button | Input | N/A | Khi chọn sẽ hiển thị thông báo thêm sản phẩm vào giỏ hàng, nếu người dùng không chọn hoặc nhập số lượng thì sẽ mặc định là 1\. Nếu người dùng không chọn thuộc tính đối với sản phẩm có thuộc tính sẽ hiển thị lỗi như hình. |
| 11 | Dịch vụ của chúng tôi  	 | List | Output | Mặc định | Các chính sách bán hàng, chăm sóc khách hàng và giao hàng. |
| 12 | Sản phẩm cùng danh mục	 | List | Output | Theo dữ liệu sản phẩm | Danh sách sản phẩm tương tự với tên, giá sản phẩm. |
| 13 | Sản phẩm đã xem | List | Output | Theo lịch sử duyệt web | Các sản phẩm mà người dùng đã xem trong lần truy cập này. |
| 14 | Hình ảnh sản phẩm | Varchar (191) | Output | Theo dữ liệu sản phẩm | Hình ảnh của sản phẩm và album hình ảnh sản phẩm nếu sản phẩm có nhiều hình ảnh. |

## Kịch bản 6: Giỏ hàng

1.1.1.a. Vai trò

Giỏ hàng là nơi tổng hợp và quản lý tất cả sản phẩm mà người dùng lựa chọn và có định mua trong quá trình xem website.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Cung cấp cho người dùng giao diện trực quan để theo dõi và quản lý các sản phẩm đã chọn mua, người dùng có thể thay đổi số lượng, thay đổi thuộc tính hoặc loại bỏ sản phẩm không có nhu cầu mua. Hiển thị chi tiết về đơn giá, tổng tiền, tình trạng sản phẩm.  
\-        Đối tượng áp dụng: Khách hàng, cộng tác viên

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Tab "Giỏ hàng" | Tab button      	 | Input | N/A | Tab chuyển sang giỏ hàng của các sản phẩm có sẵn của người dùng. |
| 2 | Tab "Giỏ hàng Order"  | Tab button      	 | Input | N/A | Tab chuyển sang giỏ hàng của các sản phẩm order của người dùng. |
| 3 | Chọn tất cả	 | Checkbox | Input | N/A | Checkbox để chọn tất cả sản phẩm trong giỏ hàng. |
| 4 | Hình ảnh sản phẩm | Varchar (191) | Output | Theo dữ liệu sản phẩm | Hình ảnh đại diện cho sản phẩm. |
| 5 | Tên sản phẩm      	 | Varchar (191) | Output | Theo dữ liệu sản phẩm | Tên của sản phẩm được thêm vào giỏ hàng. |
| 6 | Thuộc tính (nếu có) | Text | Output | Theo dữ liệu sản phẩm | Thuộc tính sản phẩm (nếu có). |
| 7 | Còn lại | Int (11) | Output | Theo dữ liệu sản phẩm | Hiển thị số lượng còn trong kho của sản phẩm đã chọn. |
| 8 | Checkbox chọn sản phẩm  | Checkbox | Input | N/A | Checkbox để chọn sản phẩm để thanh toán. |
| 9 | Số lượng | Int (11) | Output | 1 | Cho phép tăng/giảm số lượng sản phẩm, giới hạn theo số hàng còn trong kho. |
| 10 | Đơn giá  | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Giá tiền của 1 sản phẩm. |
| 11 | Giá | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Tổng giá tiền của sản phẩm đã chọn dựa theo số lượng và giá tiền 1 sản phẩm. |
| 12 | Xóa  | Button | Input | N/A | Nút xóa sản phẩm khỏi giỏ hàng. |
| 13 | Sản phẩm đã chọn | Int (11) | Output | 0 | Hiển thị số sản phẩm đã được chọn trong giỏ hàng. |
| 14 | Tổng tiền | Decimal (10, 2\) | Output | N/A | Tổng tiền các sản phẩm trong giỏ hàng. |
| 15 | Nút “Thanh toán sản phẩm đã chọn” | Button | Input | N/A | Nút chuyển sang trang đặt hàng để thực hiện thanh toán cho sản phẩm đã chọn. |

## Kịch bản 6 :Khách hàng đặt hàng có sẵn

1.1.1.a. Vai trò

	Quy trình đặt hàng giúp tiếp nhận yêu cầu từ khách hàng một cách rõ ràng và đầy đủ. Nó là cơ sở để xử lý đơn hàng, xác nhận thông tin và chuyển tiếp đến các bước tiếp theo như giao hàng và chăm sóc hậu mãi.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Đảm thông thông tin đặt hàng từ khách hàng được tiếp nhận, xác nhận và xử lý một cách chính xác, kịp thời và đúng quy trình.  
\-        Đối tượng áp dụng: Khách hàng lẻ

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Họ và tên | Varchar (191) | Input | N/A | Tên người nhận hàng, nếu người dùng không điền trường này thì sẽ mặc định là tên người dùng đăng ký tài khoản. |
| 2 | Số điện thoại      	 | Varchar (20) | Input | N/A | Số điện thoại người nhận hàng, nếu người dùng không điền trường này thì sẽ mặc định là số điện thoại đăng ký tài khoản. |
| 3 | Email | Varchar (50) | Input | N/A | Email liên hệ của khách hàng, nếu người dùng không điền trường này thì sẽ mặc định là email đăng ký tài khoản. |
| 4 | Thành phố | Dropdown | Input | N/A | Danh sách tỉnh/thành phố, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 5 | Quận/huyện      	 | Dropdown | Input | N/A | Danh sách quận/huyện tương ứng với thành phố, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 6 | Phường/xã | Dropdown | Input | N/A | Danh sách phường/xã tương ứng với quận, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 7 | Địa chỉ chi tiết 	 | Varchar (191) | Input | N/A | Địa chỉ giao hàng, nếu bỏ trống trường này sẽ hiển thị lỗi.  |
| 8 | Ghi chú giao hàng | Text | Input | N/A | Ghi chú thêm. |
| 9 | Hình ảnh sản phẩm | Varchar (191) | Output | Theo dữ liệu sản phẩm | Hình ảnh đại diện cho sản phẩm. |
| 10 | Tên sản phẩm  | Varchar (191) | Output | Theo dữ liệu sản phẩm | Tên của sản phẩm từ giỏ hàng. |
| 11 | Số lượng | Int (11) | Output | Theo dữ liệu giỏ hàng | Cho phép tăng/giảm số lượng sản phẩm, giới hạn theo số hàng còn trong kho. |
| 12 | Giá sản phẩm      	 | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Giá tiền của 1 sản phẩm. |
| 13 | Giảm giá  | Decimal (10, 2\) | Output | Theo dữ liệu chương trình khuyến mãi hoặc mã giảm giá (nếu có) | Mức giảm giá áp dụng (nếu có). |
| 14 | Phí giao hàng      	 | Decimal (10, 2\) | Output | Theo dữ liệu được cài sẵn | Hiển thị phí giao hàng. |
| 15 | Tổng tiền | Decimal (10, 2\) | Output | Tính tự động | Tổng chi phí cần thanh toán. |
| 16 | Phương thức thanh toán      	 | Radio button | Input | COD (chọn mặc định)      	 | Các hình thức: COD, Momo, VNPAY, Paypal. |
| 17 | Nút “Chọn thêm sản phẩm khác”  | Button | Input | N/A | Chuyển sang trang danh mục sản phẩm để người dùng chọn thêm sản phẩm. |
| 18 | Nút "Thanh toán đơn hàng" | Button | Input | N/A | Xác nhận đặt hàng. |
| 19 | Thông tin bổ sung | Text | Output | Hiển thị sẵn | Hiển thị về các chính sách đổi, trả hàng của công ty. |

## Kịch bản 7 :  Khách hàng đặt hàng order

1.1.1.a. Vai trò

Quy trình đặt hàng order giúp tiếp nhận yêu cầu từ khách hàng một cách rõ ràng và đầy đủ. Nó là cơ sở để xử lý đơn hàng, xác nhận thông tin và chuyển tiếp đến các bước tiếp theo như giao hàng và chăm sóc hậu mãi.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Đảm thông thông tin đặt hàng từ khách hàng được tiếp nhận, xác nhận và xử lý một cách chính xác, kịp thời và đúng quy trình.  
\-        Đối tượng áp dụng: Khách hàng lẻ

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Họ và tên | Varchar (191) | Input | N/A | Tên người nhận hàng, nếu người dùng không điền trường này thì sẽ mặc định là tên khách hàng. |
| 2 | Số điện thoại      	 | Varchar (20) | Input | N/A | Số điện thoại người nhận hàng, nếu người dùng không điền trường này thì sẽ mặc định là số điện thoại đăng ký tài khoản. |
| 3 | Email | Varchar (50) | Input | N/A | Email liên hệ của khách hàng, nếu người dùng không điền trường này thì sẽ mặc định là email đăng ký tài khoản. |
| 4 | Thành phố | Dropdown | Input | N/A | Danh sách tỉnh/thành phố, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 5 | Quận/huyện      	 | Dropdown | Input | N/A | Danh sách quận/huyện tương ứng với thành phố, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 6 | Phường/xã | Dropdown | Input | N/A | Danh sách phường/xã tương ứng với quận, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 7 | Địa chỉ chi tiết 	 | Varchar (191) | Input | N/A | Địa chỉ giao hàng (số nhà, tên đường,...), nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 8 | Ghi chú giao hàng | Text | Input | N/A | Ghi chú thêm cho đơn hàng. |
| 9 | Hình ảnh sản phẩm | Varchar (191) | Output | Theo dữ liệu sản phẩm | Hình ảnh đại diện cho sản phẩm. |
| 10 | Tên sản phẩm  | Varchar (191) | Output | Theo dữ liệu sản phẩm | Tên của sản phẩm được thêm vào giỏ hàng. |
| 11 | Số lượng | Int (11) | Output | Theo dữ liệu giỏ hàng | Cho phép tăng/giảm số lượng sản phẩm, giới hạn theo số hàng còn trong kho. |
| 12 | Giá sản phẩm      	 | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Giá tiền của 1 sản phẩm. |
| 13 | Giảm giá  | Decimal (10, 2\) | Output | Theo dữ liệu chương trình khuyến mãi hoặc mã giảm giá (nếu có) | Mức giảm giá áp dụng (nếu có). |
| 14 | Phí giao hàng      	 | Decimal (10, 2\) | Output | Theo dữ liệu được cài sẵn | Hiển thị phí giao hàng. |
| 15 | Tổng tiền | Decimal (10, 2\) | Output | Tính tự động | Tổng chi phí cần thanh toán. |
| 16 | Phương thức thanh toán      	 | Radio button | Input | COD (chọn mặc định)      	 | Các hình thức: COD, Momo, VNPAY, Paypal. |
| 17 | Nút “Chọn thêm sản phẩm khác”  | Button | Input | N/A | Chuyển sang trang danh mục sản phẩm để người dùng chọn thêm sản phẩm. |
| 18 | Nút "Thanh toán đơn hàng" | Button | Input | N/A | Xác nhận đặt hàng. |
| 19 | Thông tin bổ sung | Text | Output | Hiển thị sẵn | Hiển thị về các chính sách đổi, trả hàng của công ty. |

## Kịch bản 8: Cộng tác viên đặt hàng có sẵn

1.1.1.a. Vai trò

Quy trình đặt hàng giúp tiếp nhận yêu cầu từ cộng tác viên một cách rõ ràng và đầy đủ. Nó là cơ sở để xử lý đơn hàng, xác nhận thông tin và chuyển tiếp đến các bước tiếp theo như giao hàng và chăm sóc hậu mãi.

1.1.1.b. Mục đích và đối tượng áp dụng

\-        Mục đích: Đảm bảo thông tin đặt hàng từ cộng tác viên được tiếp nhận, xác nhận và xử lý một cách chính xác, kịp thời và đúng quy trình.  
\-        Đối tượng áp dụng: Cộng tác viên  
a. Mô tả chi tiết các thành phần

| STT | Tên | Kiểu dữ liệu \[Độ dài dữ liệu\] | Input / Output | Giá trị khởi tạo | Mô tả  |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | Họ và tên | Varchar (191) | Input | N/A | Tên người nhận hàng, nếu người dùng không điền trường này thì sẽ mặc định là tên người dùng đăng ký tài khoản. |
| 2 | Số điện thoại | Varchar (20) | Input | N/A | Số điện thoại người nhận hàng, nếu người dùng không điền trường này thì sẽ mặc định là số điện thoại đăng ký tài khoản. |
| 3 | Email | Varchar (50) | Input | N/A | Email liên hệ của khách hàng, nếu người dùng không điền trường này thì sẽ mặc định là email đăng ký tài khoản. |
| 4 | Thành phố | Dropdown | Input | N/A | Danh sách tỉnh/thành phố, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 5 | Quận/huyện  | Dropdown | Input | N/A | Danh sách quận/huyện tương ứng với thành phố, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 6 | Phường/xã | Dropdown | Input | N/A | Danh sách phường/xã tương ứng với quận, nếu người dùng bỏ trống trường này sẽ hiển thị lỗi.  |
| 7 | Địa chỉ chi tiết 	 | Varchar (191) | Input | N/A | Địa chỉ giao hàng, nếu người dùng bỏ trống trường sẽ hiển thị lỗi.  |
| 8 | Ghi chú giao hàng | Text | Input | N/A | Ghi chú thêm. |
| 9 | Hình ảnh sản phẩm | Varchar (191) | Output | Theo dữ liệu sản phẩm | Hình ảnh đại diện cho sản phẩm. |
| 10 | Tên sản phẩm      	 | Varchar (191) | Output | Theo dữ liệu sản phẩm | Tên của sản phẩm trong giỏ hàng. |
| 11 | Số lượng | Int (11) | Output | Theo dữ liệu giỏ hàng | Cho phép tăng/giảm số lượng sản phẩm, giới hạn theo số hàng còn trong kho. |
| 12 | Giá sản phẩm | Decimal (10, 2\) | Output | Theo dữ liệu sản phẩm | Giá tiền của 1 sản phẩm. |
| 13 | Giảm giá  | Decimal (10, 2\) | Output | Theo dữ liệu chương trình khuyến mãi hoặc mã giảm giá (nếu có) | Mức giảm giá áp dụng (nếu có). |
| 14 | Tổng tiền | Decimal (10, 2\) | Output | Tính tự động | Tổng chi phí cần thanh toán. |
| 15 | Giá thu hộ | Decimal (10, 2\) | Input | N/A | Giá thu hộ của 1 sản phẩm do cộng tác viên nhập, nếu không nhập sẽ hiển thị lỗi. |
| 16 | Checkbox chọn “Khách hàng trả tiền ship” | Checkbox | Input | N/A | Nếu cộng tác viên tích trường này thì khách hàng sẽ trả tiền ship, nếu cộng tác viên không tích thì sẽ mặc định cộng tác viên trả tiền ship. |
| 17 | Chiết khấu nhận về | Decimal (10, 2\) | Output | N/A | Chiết khấu cộng tác viên sẽ nhận được. |
| 18 | Mã giảm giá | Varchar (2) | Input | N/A | Chọn mã giảm giá nếu có.  |
| 19 | Phương thức thanh toán 	 | Radio button | Input | COD (chọn mặc định)  | Các hình thức: COD, Momo, VNPAY, Paypal. |
| 20 | Nút "Thanh toán đơn hàng" | Button | Input | N/A | Xác nhận đặt hàng. |
| 21 | Thông tin bổ sung | Text | Output | Hiển thị sẵn | Hiển thị về các chính sách đổi, trả hàng của công ty. |

