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
						joth.cipher.encode(str),
						window.CryptoJS.enc.Utf8.parse(secret.key),
						{
							iv: window.CryptoJS.enc.Utf8.parse(secret.iv),
							mode: window.CryptoJS.mode.CBC,
						}
					).toString()
				},

				decode(str, secret) {
					secret = joth.cipher.aes.getKeyAndIv(secret);

					return joth.cipher.decode(window.CryptoJS.AES.decrypt(
						str,
						window.CryptoJS.enc.Utf8.parse(secret.key),
						{
							iv: window.CryptoJS.enc.Utf8.parse(secret.iv),
							mode: window.CryptoJS.mode.CBC,
						}
					).toString(window.CryptoJS.enc.Utf8))
				},
			},

			encode(value) {
				return window.CryptoJS.enc.Base64.stringify(window.CryptoJS.enc.Utf8.parse(window.JSON.stringify(value)))
			},

			decode(value) {
				return window.JSON.parse(CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(value)))
			},
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
			) {
				var data = this.getParamsAsObject(typeof request.data === 'object' ? jquery.param(request.data) : request.data),
					attrs = this.getAttrs(options.url);

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
			path = path.replace(window.location.protocol + '//' + window.location.host, '');

			for (key in this.namedAttrs) {
				var keyReplaced = key.replace(/\*/g, '.*'),
					regex = new RegExp('^' + keyReplaced + '$', 'u'),
					regexTrimed = new RegExp('^' + this.trim(keyReplaced, '/') + '$', 'u');

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

		getParamsAsObject(query) {
			query = query.substring(query.indexOf('?') + 1);

			var re = /([^&=]+)=?([^&]*)/g;
			var decodeRE = /\+/g;

			var decode = function (str) {
				return decodeURIComponent(str.replace(decodeRE, " "));
			};

			var params = {}, e;
			while (e = re.exec(query)) {
				var k = decode(e[1]), v = decode(e[2]);

				if (k.substring(k.length - 2) === '[]') {
					k = k.substring(0, k.length - 2);
					(params[k] || (params[k] = [])).push(v);
				}
				else params[k] = v;
			}

			var assign = function (obj, keyPath, value) {
				var lastKeyIndex = keyPath.length - 1;
				for (var i = 0; i < lastKeyIndex; ++i) {
					var key = keyPath[i];
					if (!(key in obj))
						obj[key] = {};
					obj = obj[key];
				}

				obj[keyPath[lastKeyIndex]] = value;
			};

			for (var prop in params) {
				var structure = prop.split('[');

				if (structure.length > 1) {
					var levels = [];
					structure.forEach(function (item, i) {
						var key = item.replace(/[?[\]\\ ]/g, '');
						levels.push(key);
					});
					assign(params, levels, params[prop]);
					delete (params[prop]);
				}
			}

			return params;
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
