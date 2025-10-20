# 一、接口名称

推送组织机构新增、修改、删除接口

# 二、接口详情

需要下游提供接口获取组织机构信息，IAM推送组织机构变更信息（新增、修改、删除）

# 三、接口地址

下游系统提供，需要接收以下报文

# 四、请求方式

https+json的POST请求

# 五、接口参数

请求参数（AES密文，需下游系统自行解密）：

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>data</td><td>请求参数</td><td>Map</td><td>是</td><td>为AES加密串，需要下游系统自行进行aes解密（对接时，齐鲁提供aes密钥）</td></tr></table>

data参数：  

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr><tr><td>bimRequestId</td><td>请求流水号</td><td>String</td><td>是</td><td>92b2df66575a430f89f9280f4bc758f8（问题跟踪排查问题时使用，无实际意义）</td></tr><tr><td>orgCode</td><td>组织机构代码</td><td>String</td><td>否</td><td>102006（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>orgName</td><td>组织机构名称</td><td>String</td><td>否</td><td>齐鲁动物保健品有限公司（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>orgStatus</td><td>组织机构状态</td><td>String</td><td>否</td><td>true/false（新增时有值，修改/禁用/启用时若该字段变动，则有值）</td></tr><tr><td>orgParentCode</td><td>上级组织机构</td><td>String</td><td>否</td><td>102006，为空时说明不存在上级</td></tr><tr><td>orgType</td><td>组织机构类型</td><td>String</td><td>否</td><td>1、公司；2、部门（新增时有值，修改时若该字段变动，则有值）</td></tr><tr><td>bimOrgId</td><td>组织机构id</td><td>String</td><td>否</td><td>新增是为空，修改或禁用时有值（新增时，下游系统返回的id）</td></tr></table>

# 六、响应参数 （明文）

<table><tr><td>参数名称</td><td>参数描述</td><td>参数类型</td><td>是否必填</td><td>示例值</td></tr></table>

<table><tr><td>bimRequestId</td><td>请求流水号</td><td>String</td><td>是</td><td>请求报文中的值</td></tr><tr><td>resultCode</td><td>响应码</td><td>String</td><td>是</td><td>0：成功；非 0：失败</td></tr><tr><td>message</td><td>响应描述信息</td><td>String</td><td>是</td><td>0：成功；非 0：错误描述</td></tr><tr><td>uid</td><td>组织机构 id</td><td>String</td><td>否</td><td>resultCode为 0 时，必填（本地保存后，组织机构的 id）</td></tr></table>

# 七、示例报文

请求报文：

{ "data":"iLrY644ZFxpzP56Nlo8B4NtcaVkVRabCply5JLfYl4rzVb/7dGkg0jpLcCq+z6WRMPn 531oRMLcunPzijlqZimxrcd1RetWyCKUBs8FRW3bbXGlZFUWmwqS8uSS32JeKDavmmcPbBpB6 ilnTotNnkVxv5kvXDex6w6MnYO66bo8=" }

新增请求解密报文：

{ "orgName":"安徽华星化工有限公司", "bimRequestId":"9f397c54222a4f98b9d9b5b278e55fb8", "orgStatus":"true", "orgType":"1", "orgCode":"102582", "orgParentCode":"000334" }

修改请求解密报文：

{ "orgName":"齐鲁制药集团总部11", "bimRequestId":"7c55c76eb3f48958e9f5b42c2dda543", "bimOrgId":"3333847ffca4bc7b0174950fdd35555" }

禁用启用请求解密报文：

{ "bimRequestId":"c5dbcb0886e44218aac92492834ad6fd", "bimOrgId":"3333847ffca4bc7b0174950fdd35555", "orgStatus":false }

}

响应报文：

{ "bimRequestId":"3c7784f7ffca4bc7b0174950fdd3a6f2", "resultCode":"0", "message":"新增组织机构成功！", "uid":"333384f7ffca4bc7b0174950fdd35555" }