# 一、接口名称

推送账户信息新增、修改、删除接口

# 二、接口详情

需要下游提供接口获取IAM账户信息的新增、修改、删除数据

# 三、接口地址

下游系统提供，需要接收以下报文

# 四、请求方式

https+json的POST请求

# 五、接口参数

请求参数（AES密文，需下游系统自行解密）：

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>data</td><td>请求参数</td><td>Map</td><td>是</td><td>为AES加密串，需要下游系统自行进行aes解密（对接时，齐鲁提供aes密钥）</td></tr></table>

data参数：

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>bimRequestId</td><td>请求流水号</td><td>String</td><td>是</td><td>92b2df66675a430f89f9280f4bc758f8（问题跟踪排查问题时使用，无实际意义）</td></tr><tr><td>orgCode</td><td>人员所属组织机构代码</td><td>String</td><td>否</td><td>102006（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>userCode</td><td>员工工号</td><td>String</td><td>否</td><td>041222（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>userName</td><td>员工姓名</td><td>String</td><td>否</td><td>张三（新增时有值，修改/禁用/启用时若该字段变动，则有值）</td></tr><tr><td>userEmail</td><td>员工邮箱</td><td>String</td><td>否</td><td>邮箱信息</td></tr><tr><td>gender</td><td>性别</td><td>String</td><td>否</td><td>1、男；0、女（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>userStatus</td><td>用户状态</td><td>String</td><td>否</td><td>true/false（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>bimUid</td><td>用户ID</td><td>String</td><td>否</td><td>修改时有值（为新增用户时，用户返回的本</td></tr></table>

# 六、响应参数 （明文）

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>bimRequestId</td><td>请求流水号</td><td>String</td><td>是</td><td>请求报文中的值</td></tr><tr><td>resultCode</td><td>响应码</td><td>String</td><td>是</td><td>0：成功；非 0：失败</td></tr><tr><td>message</td><td>响应描述信息</td><td>String</td><td>是</td><td>0：成功；非 0：错误描述</td></tr><tr><td>uid</td><td>用户 id</td><td>String</td><td>否</td><td>resultCode为 0 时，必填（本地保存后，用户信息的 id）</td></tr></table>

# 七、示例报文

请求报文：

{"data":"iLrY644ZFxpZP56Nlo8B4NtcaVkVRabCpLy5JLfY4rzVb/7dGkg0jpLcCq+z6WRMPn 531oRMLcunPzijlqZimxrcd1RetWyCKUBs8FRW3bbXGlZFUWmwqS8uSS32JeKDavmmcPbBpB6 ilnTotNnkVxv5kvXDex6wV6mY066bo8="

新增请求加密报文：

{"userStatus":"true", "gender":"1", "bimRequestId":"ad3ebc398efa4196ac3bc01a99600454", "userName":"张三", "贻Code":"041222", "orgCode":"004703", "userEmail":"san.zhang@qilu- pharma.com"}

修改请求加密报文：

{"userName":"张三1", "bimRequestId":"c277f4bf44054d6e91d2abeba4d586f1", "bimUid":"d277f4bf44054d6e91d2abeba4d58444"}

禁用启用请求加密报文：

{"userStatus":false, "bimRequestId":"c277f4bf44054d6e91d2abeba4d586f1", "bimUid":"d277f4bf44054d6e91d2abeba4d58444"}

{    "bimRequestId": "3c7784f7ffca4bc7b0174950fdd3a6f2",    "resultCode": "0",    "message": "新增人员信息成功!",    "uid": "333384f7ffca4bc7b0174950fdd35555"}