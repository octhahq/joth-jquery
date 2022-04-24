joth = (function (window, document, jquery) {
	var joth = {
		namedAttrs: [],
		attrs: [],
		modifyMethods: ['post', 'put', 'patch'],
		algorithm: 'aes',
		cipher: {
			aes: {
				getKeyAndIv(secret) {
					return {
						key: secret.substr(0, 32),
						iv: secret.substr(32, 16),
					}
				},

				encode(str, secret) {
					secret = joth.cipher.aes.getKeyAndIv(secret);

					return window.CryptoJS.AES.encrypt(
						str,
						window.CryptoJS.enc.Utf8.parse(secret.key),
						{
							iv: window.CryptoJS.enc.Utf8.parse(secret.iv),
							mode: window.CryptoJS.mode.CBC,
						}
					).toString()
				},

				decode(str, secret) {
					secret = joth.cipher.aes.getKeyAndIv(secret);

					return window.CryptoJS.AES.decrypt(
						str,
						window.CryptoJS.enc.Utf8.parse(secret.key),
						{
							iv: window.CryptoJS.enc.Utf8.parse(secret.iv),
							mode: window.CryptoJS.mode.CBC,
						}
					).toString(window.CryptoJS.enc.Utf8)
				},
			},

			urlsafeB64Encode(str) {
				return str.replace(/\+/g, '-')
					.replace(new RegExp('\/', 'g'), '.')
					.replace(/=/g, '_')
			},

			urlsafeB64Decode(str) {
				return str.replace(/-/g, '+')
					.replace(/\./g, '/')
					.replace(/_/g, '=')
			},

			init() {
				this.aes.parent = this;
			}
		},

		secret(str) {
			secret(str)
		},

		to(url, ...data) {
			this.namedAttrs[url] = this.filter(data.flat(Infinity))
		},

		setAttr(...data) {
			data = this.filter(data.flat(Infinity));

			for (k in data) {
				value = data[k];

				if (!this.attrs.includes(value)) {
					this.attrs.push(value)
				}
			}
		},

		modifyRequest(options, request) {
			if (
				this.modifyMethods.includes(options.type.toLowerCase())
				&& request.data !== null
				&& typeof request.data === 'object'
			) {
				var data = request.data,
					attrs = this.getAttrs(options.url);

				if (
					Array.isArray(data)
					&& data.length > 0
					&& typeof data[0] === 'object'
					&& 'name' in data[0]
					&& 'value' in data[0]
				) {
					data = data.reduce(function (accumulator, value) {
						accumulator[value.name] = value.value;
						return accumulator
					}, {})
				}

				this.resolveAttrs(attrs, data, this.cipher.aes.encode);

				options.data = this.serialize(data)
			}
		},

		modifyResponse(data) {
			if (this.isJson(data)) {
				var data = window.JSON.parse(data),
					attrs = this.getAttrs(data.pathForJoth || '');

				this.resolveAttrs(attrs, data, this.cipher.aes.decode);

				return window.JSON.stringify(data)
			}
		},

		getAttrs(path) {
			for (key in this.namedAttrs) {
				var keyReplaced = key.replace(/\*/g, '.*'),
					regex = new RegExp(`^${keyReplaced}$`, 'u'),
					regexTrimed = new RegExp(`^${this.trim(keyReplaced, '/')}$`, 'u');

				if (
					regex.test(path)
					|| regexTrimed.test(path)
				) {
					return this.namedAttrs[key]
				}
			}

			return this.attrs
		},

		resolveAttrs(attrs, data, resolver) {
			var secretKey = secret();

			if (!secretKey) return;

			for (key in attrs) {
				var attr = attrs[key];

				if (value = this.getValue(data, attr)) {
					this.setValue(data, attr, resolver(value, secretKey))
				}
			}
		},

		serialize(obj, prefix) {
			var str = [],
				p;

			for (p in obj) {
				if (obj.hasOwnProperty(p)) {
					var k = prefix ? prefix + '[' + p + ']' : p,
						v = obj[p];

					str.push(
						(v !== null && typeof v === 'object')
							? this.serialize(v, k)
							: encodeURIComponent(k) + '=' + encodeURIComponent(v)
					);
				}
			}

			return str.join('&');
		},

		filter(data) {
			return this.unique(data.filter(Boolean)
				.filter(value => ['string', 'number'].includes(typeof value))
				.map(String))
		},

		unique(array) {
			return array.filter(function (value, index, self) {
				return self.indexOf(value) === index;
			});
		},

		trim(string, c) {
			if (c === "]") c = "\\]";
			if (c === "^") c = "\\^";
			if (c === "\\") c = "\\\\";

			return string.replace(new RegExp(
				"^[" + c + "]+|[" + c + "]+$", "g"
			), "");
		},

		getValue(obj, path, defaultValue = undefined) {
			const travel = regexp =>
				String.prototype.split
					.call(path, regexp)
					.filter(Boolean)
					.reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);

			const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);

			return result === undefined || result === obj ? defaultValue : result;
		},

		setValue(obj, path, value) {
			if (Object(obj) !== obj) return obj;
			if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
			path.slice(0, -1).reduce((a, c, i) =>
				Object(a[c]) === a[c]
					? a[c]
					: a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1]
						? []
						: {},
				obj)[path[path.length - 1]] = value;

			return obj;
		},

		isJson(str) {
			try {
				return (JSON.parse(str) && !!str);
			} catch (e) {
				return false;
			}
		}
	},
		jothSecret = '';

	function secret(str) {
		if (str) {
			jothSecret = str
		}

		return jothSecret
	}

	jquery.ajaxPrefilter(function (options, original) {
		joth.modifyRequest(options, original)
	});

	jquery.ajaxSetup({
		dataFilter: function (data, type) {
			return joth.modifyResponse(data, type)
		}
	});

	[
		'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
	].forEach(function (url) {
		var script = document.createElement('script');
		script.src = url;
		document.head.appendChild(script);
	});

	return joth;
})(window, document, jQuery || window.jQuery || $ || window.$);
