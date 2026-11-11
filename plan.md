1. Viết 1 web app quản lý và làm bài quiz cho giáo viên học sinh.
2. Technical: chọn stack nhẹ nhất cho BE + FE + DB.
3. Requirement chung
    - phải chia authentication và author ra làm 3 roles. Admin, Teacher và Student.
    - admin: có sidebar và yêu cầu login khi vào /admin
        - quản lý thông tin giáo viên (CRUD) + tài khoản giáo viên + search + filter
        - có các quyền của giáo viên.
        - setting: ngôn ngữ và theme
    - teacher: có sidebar và có yêu cầu login khi vào /teacher
        - quản lý bài quiz (CRUD) + search + filter.
        - câu hỏi phải có dạng tự luận và trắc nghiệm.
        - khi tạo bài quiz teacher có thể tạo link quiz và gửi cho student. giới hạn thời gian làm bài và thời gian expire link quiz. gia hạn thời gian.
        - quản lý kết quả bài quiz + search + filter. xuất kết quả ra file excel
        - setting: ngôn ngữ và theme.
    - student:
        - khi nhấn vô link giáo viên đưa sẽ phải nhập họ tên và lớp
        - sau đó làm bài quiz và có thời gian đếm ngược do giáo viên set bên góc trái.
        - khi hết thời gian tự động nộp bài
        - thông tin student và câu đã làm sẽ lưu ở local
        - trong thời gian làm bài mà bị thoát ra hoặc mất kết nối mạng sẽ ghi nhớ và khi reconnect lại sẽ còn nguyên bài.
        - thời gian làm bài cứ trôi kể cả khi student bị thoát hoặc mất kết nối mạng
4. UI phải làm dạng sáng sủa phù hợp với làm bài quiz
