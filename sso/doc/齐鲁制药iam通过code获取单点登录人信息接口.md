# 一、接口名称

通过code获取单点登录用户信息接口

# 二、接口详情

二、接口详情下游系统在IAM中配置后，点击登录图标会跳转至下游系统指定URL，带着code的参数，下游系统需要通过code调用当前接口获取登录人信息

# 三、接口地址

三、接口地址http://172.17.12.66:9000/baseservice-1.0/iamToDownStream/authLoginlam

# 四、请求方式

https+json的POST请求

# 五、接口参数

请求参数：  

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>code</td><td>IAM 回传至下游系统的 code</td><td>String</td><td>是</td><td>2222222222</td></tr><tr><td>systemCode</td><td>系统代码</td><td>String</td><td>是</td><td>JCBZH</td></tr></table>

# 六、响应参数

Data  

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>code</td><td>响应码</td><td>String</td><td>是</td><td>0：成功；1：失败</td></tr><tr><td>msg</td><td>响应描述信息</td><td>String</td><td>是</td><td>0：成功；非 0：失败</td></tr><tr><td>data</td><td>返回信息</td><td>Boolean</td><td>是</td><td>响应数据</td></tr></table>

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>字段说明</td></tr><tr><td>userCode</td><td>登录人工号</td><td>String</td><td>041222</td></tr><tr><td>userName</td><td>登录人姓名</td><td>String</td><td>张三</td></tr><tr><td>orgCode</td><td>登录人所属组织机构</td><td>String</td><td>004706</td></tr></table>

# 七、示例报文

请求报文：

{ "code": "22222222", "systemCode": "JCBZH"}响应报文：{ "code": "0", "msg": "获取登录人信息成功", "data": {    "userCode": "041222",    "userName": "张三",    "orgCode": "004706"}