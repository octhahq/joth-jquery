# 🥨 Joth jquery - Encrypt and decrypt requests and responses data

## Why use this?

If you need to transit sensitive data you know leaving it in plaintext is not ideal, so using a layer that makes the data more difficult to capture is essential.

## Installation

```html
<script src="https://cdn.jsdelivr.net/gh/octhahq/joth-jquery/joth.min.js"></script>
```

## Usage

### Define a secret key

This key is used to encrypt and decrypt the data. It must contain 48 characters.

```javascript
joth.secret('a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e');
```

### Setting attributes to specific endpoint

```javascript
joth.to('/auth', 'email', 'password');

joth.to('/user/*', 'email', 'name');

joth.to('/invoice', ['name', 'address']);
```

### Setting global attributes

```javascript
joth.setAttr('email', 'password');

joth.setAttr(['name', 'address']);
```

## License

This package is licensed under the [MIT license](LICENSE) © [Octha](https://octha.com).
