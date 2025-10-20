### /api/oauth/token  RFC6749规范

**注意: 此请求返回值按[RFC6749](https://tools.ietf.org/html/rfc6749)及[OAuth2](https://oauth.net/2/grant-types/client-credentials/)规范返回 **

- 请求地址：http://[域名]/api/oauth/token
- 请求方法：POST
- 请求体格式(Body): application/x-www-form-urlencode
- 响应体格式(Body): application/json
- 请求参数：

| 参数名        | 参数类型 | 是否必须           | 描述                                                         |
| ------------- | -------- | ------------------ | ------------------------------------------------------------ |
| client_id     | 字符串   | 是                 | 应用ID, 请管理后台应用管理中查看或联系管理员查看             |
| client_secret | 字符串   | 是                 | 应用密钥, 请管理后台应用管理中查看或联系管理员查看           |
| grant_type    | 字符串   | 是                 | 支持客户端凭据模式或授权码模式，client_credentials 或 authorization_code |
| code          | 字符串   | 是(授权码模式必传) | 授权码模式 使用                                              |
| redirect_uri  | 字符串   | 是(授权码模式必传) | 授权码模式 使用                                              |

- 请求示例:

```
curl --location --request POST 'https://xxxx/api/oauth/token' \
--form 'client_id="26"' \
--form 'client_secret="EQ3szF9RlKrNzbVaKWLD2BRLp4jAO3N6QZBg"' \
--form 'grant_type="client_credentials"'
```

- 正常返回:

```
{
    "access_token": "398fa6cd-f69f-4566-98ec-308f487c0988",
    "expires_in": 5476,
    "token_type": "bearer"
}
```

- 异常返回:

[参照RFC6749规范](https://tools.ietf.org/html/rfc6749#section-5.2)





### /api/oauth/authorize  RFC6749规范

**注意: 此请求返回值按[RFC6749](https://tools.ietf.org/html/rfc6749)及[OAuth2](https://oauth.net/2/grant-types/client-credentials/)规范返回, 而非本设计项目接口规范** ** Scope与Claim部分 参照OIDC1.0规范 https://openid.net/specs/openid-connect-core-1_0.html#IDToken

- 请求地址：http://[域名]/api/oauth/authorize
- GET
- 请求体格式(Body): application/x-www-form-urlencode
- 响应体格式(Body): 无

| 参数名        | 参数类型 | 是否必须 | 描述                                             |
| ------------- | -------- | -------- | ------------------------------------------------ |
| client_id     | 字符串   | 是       | 应用ID, 请管理后台应用管理中查看或联系管理员查看 |
| redirect_uri  | 字符串   | 否       | 编码后的(登录回调地址)                           |
| response_type | 字符串   | 是       | 固定值 code                                      |
| scope         | 字符串   | 否       | 支持 openid,profile,email,phone                  |
| state         | 随机数   | 建议传参 |                                                  |

- Scope及Claims包含关系

```plaintext
  Scope名称  Scope说明     包含Claims
  openid     用户ID        规范包含(sub)
  profile    用户基本信息   规范包含(name, family_name, given_name, middle_name, nickname, preferred_username, profile, picture, website, gender, birthdate, zoneinfo, locale, updated_at) 如果claims存在则返回
  email      用户邮件      规范包含(email, email_verified) 如果claims存在则返回
  phone      用户手机      规范包含(phone_number,phone_number_verified) 如果claims存在则返回
```



- Claims字段映射关系

```plaintext
  claims               类型    说明    映射字段
  sub                  标准    唯一ID  uid (唯一且不变)
  preferred_username   标准    用户名   username (唯一但可能发生改变)
  email                标准    邮箱地址  email
  phone_number         标准    手机号   mobile
  uuid                 自定义  uuid    uuid (唯一且不变)
```



- 登录成功无其它异常返回(302):

```plaintext
应用设置的回调提示
302 redirectUrl?code=xxxx&state=xxxx
```



- 登录成功但存在无权限异常(302):

```plaintext
无改应用权限的
返回提示界面
```



- 异常返回(302)

```plaintext
返回到单点登录的登录界面
```





### /api/oauth/userinfo  RFC6749规范