Clockwork.controller('PanelController', function($scope, $http, toolbar)
{
	$scope.activeId = null;
	$scope.requests = {};

	$scope.activeCacheStats = {};
	$scope.activeCacheQueries = [];
	$scope.activeCookies = [];
	$scope.activeDatabaseQueries = [];
	$scope.activeEmails = [];
	$scope.activeGetData = [];
	$scope.activeHeaders = [];
	$scope.activeLog = [];
	$scope.activePostData = [];
	$scope.activeRequest = undefined;
	$scope.activeRoutes = [];
	$scope.activeSessionData = [];
	$scope.activeTimeline = [];
	$scope.activeTimelineLegend = [];
	$scope.activeViews = [];

	$scope.showIncomingRequests = true;

	$scope.init = function(type)
	{
		if (type == 'chrome-extension') {
			$scope.initChrome();
		} else {
			$scope.initStandalone();
		}

		this.createToolbar();
	};

	$scope.initChrome = function()
	{
		key('⌘+k, ctrl+l', function() {
			$scope.$apply(function() {
				$scope.clear();
			});
		});

		if (chrome.devtools.panels.themeName === 'dark') {
			$('body').addClass('dark')
		}

		chrome.devtools.network.onRequestFinished.addListener(function(request)
		{
			var headers = request.response.headers;
			var requestId = headers.find(function(x) { return x.name.toLowerCase() == 'x-clockwork-id'; });
			var requestVersion = headers.find(function(x) { return x.name.toLowerCase() == 'x-clockwork-version'; });
			var requestPath = headers.find(function(x) { return x.name.toLowerCase() == 'x-clockwork-path'; });

			var requestHeaders = {};
			$.each(headers, function(i, header) {
				if (header.name.toLowerCase().indexOf('x-clockwork-header-') === 0) {
					originalName = header.name.toLowerCase().replace('x-clockwork-header-', '');
					requestHeaders[originalName] = header.value;
				}
			});

			if (requestVersion !== undefined) {
				var uri = new URI(request.request.url);
				var path = ((requestPath) ? requestPath.value : '/__clockwork/') + requestId.value;

				path = path.split('?');
				uri.pathname(path[0]);
				if (path[1]) {
					uri.query(path[1]);
				}

				chrome.runtime.sendMessage(
					{ action: 'getJSON', url: uri.toString(), headers: requestHeaders },
					function (data){
						$scope.$apply(function(){
							$scope.addRequest(requestId.value, data);
						});
					}
				);
			}
		});
	};

	$scope.initStandalone = function()
	{
		// generate a hash of get params from query string (http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values)
		var getParams = (function(a) {
			if (a === '') return {};
			var b = {};
			for (var i = 0; i < a.length; ++i) {
				var p = a[i].split('=');
				if (p.length != 2) continue;
				b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
			}
			return b;
		})(window.location.search.substr(1).split('&'));

		if (getParams['id'] === undefined)
			return;

		$http.get('/__clockwork/' + getParams['id']).success(function(data){
			$scope.addRequest(getParams['id'], data);
		});
	};

	$scope.createToolbar = function()
	{
		toolbar.createButton('ban', 'Clear', function()
		{
			$scope.$apply(function() {
				$scope.clear();
			});
		});

		$('.toolbar').replaceWith(toolbar.render());
	};

	$scope.addRequest = function(requestId, data)
	{
		data.responseDurationRounded = data.responseDuration ? Math.round(data.responseDuration) : 0;
		data.databaseDurationRounded = data.databaseDuration ? Math.round(data.databaseDuration) : 0;

		data.cacheQueries = $scope.processCacheQueries(data.cacheQueries);
		data.cookies = $scope.createKeypairs(data.cookies);
		data.databaseQueries = $scope.processDatabaseQueries(data.databaseQueries);
		data.emails = $scope.processEmails(data.emailsData);
		data.getData = $scope.createKeypairs(data.getData);
		data.headers = $scope.sortKeypairs($scope.processHeaders(data.headers));
		data.log = $scope.processLog(data.log);
		data.postData = $scope.createKeypairs(data.postData);
		data.sessionData = $scope.createKeypairs(data.sessionData);
		data.timeline = $scope.processTimeline(data);
		data.views = $scope.processViews(data.viewsData);

		data.errorsCount = $scope.getErrorsCount(data);
		data.warningsCount = $scope.getWarningsCount(data);

		$scope.requests[requestId] = data;

		if ($scope.showIncomingRequests) {
			$scope.setActive(requestId);
		}
	};

	$scope.clear = function()
	{
		$scope.requests = {};
		$scope.activeId = null;

		$scope.activeCacheStats = {};
		$scope.activeCacheQueries = [];
		$scope.activeCookies = [];
		$scope.activeDatabaseQueries = [];
		$scope.activeEmails = [];
		$scope.activeGetData = [];
		$scope.activeHeaders = [];
		$scope.activeLog = [];
		$scope.activePostData = [];
		$scope.activeRequest = undefined;
		$scope.activeRoutes = [];
		$scope.activeSessionData = [];
		$scope.activeTimeline = [];
		$scope.activeTimelineLegend = [];
		$scope.activeViews = [];

		$scope.showIncomingRequests = true;
	};

	$scope.setActive = function(requestId)
	{
		$scope.activeId = requestId;

		var request = $scope.requests[requestId];

		$scope.activeCacheStats = {
			reads: request.cacheReads,
			hits: request.cacheHits,
			misses: request.cacheReads && request.cacheHits ? request.cacheReads - request.cacheHits : null,
			writes: request.cacheWrites,
			deletes: request.cacheDeletes,
			time: request.cacheTime
		};
		$scope.activeCacheQueries = request.cacheQueries;
		$scope.activeCookies = request.cookies;
		$scope.activeDatabaseQueries = request.databaseQueries;
		$scope.activeEmails = request.emails;
		$scope.activeGetData = request.getData;
		$scope.activeHeaders = request.headers;
		$scope.activeLog = request.log;
		$scope.activePostData = request.postData;
		$scope.activeRequest = request;
		$scope.activeRoutes = request.routes;
		$scope.activeSessionData = request.sessionData;
		$scope.activeTimeline = request.timeline;
		$scope.activeTimelineLegend = $scope.generateTimelineLegend();
		$scope.activeViews = request.views;

		var lastRequestId = Object.keys($scope.requests)[Object.keys($scope.requests).length - 1];

		$scope.showIncomingRequests = requestId == lastRequestId;
	};

	$scope.getClass = function(requestId)
	{
		if (requestId == $scope.activeId) {
			return 'selected';
		} else {
			return '';
		}
	};

	$scope.showDatabaseConnectionColumn = function()
	{
		var connections = {};

		$scope.activeDatabaseQueries.forEach(function(query)
		{
			connections[query.connection] = true;
		});

		return Object.keys(connections).length > 1;
	};

	$scope.showCacheTab = function ()
	{
		var cacheProps = [ 'cacheReads', 'cacheHits', 'cacheWrites', 'cacheDeletes', 'cacheTime' ];

		if (! this.activeRequest) return;

		return cacheProps.some(prop => this.activeRequest[prop] !== null && this.activeRequest[prop] !== undefined)
			|| this.activeCacheQueries.length;
	};

	$scope.showCacheQueriesConnectionColumn = function ()
	{
		return this.activeCacheQueries && this.activeCacheQueries.some(query => query.connections)
	};

	$scope.showCacheQueriesDurationColumn = function ()
	{
		return this.activeCacheQueries && this.activeCacheQueries.some(query => query.duration)
	};

	$scope.createKeypairs = function(data)
	{
		var keypairs = [];

		if (!(data instanceof Object)) {
			return keypairs;
		}

		$.each(data, function(key, value){
			keypairs.push({name: key, value: value});
		});

		return $scope.sortKeypairs(keypairs)
	};

	$scope.sortKeypairs = function (keypairs)
	{
		return keypairs.sort((a, b) => a.name.localeCompare(b.name))
	}

	$scope.generateTimelineLegend = function()
	{
		var items = [];

		var maxWidth = $('.timeline-graph').width();
		var labelCount = Math.floor(maxWidth / 80);
		var step = $scope.activeRequest.responseDuration / (maxWidth - 20);

		for (var j = 2; j < labelCount + 1; j++) {
			items.push({
				left: (j * 80 - 35).toString(),
				time: Math.round(j * 80 * step).toString()
			});
		}

		if (maxWidth - ((j - 1) * 80) > 45) {
			items.push({
				left: (maxWidth - 35).toString(),
				time: Math.round(maxWidth * step).toString()
			});
		}

		return items;
	};

	$scope.processCacheQueries = function(data)
	{
		if (! (data instanceof Array)) return [];

		data.forEach(query => {
			query.expiration = query.expiration ? this.formatTime(query.expiration) : undefined;
			query.value = query.type == 'hit' || query.type == 'write' ? query.value : '';
			query.fullPath = query.file && query.line ? query.file.replace(/^\//, '') + ':' + query.line : undefined;
			query.shortPath = query.fullPath ? query.fullPath.split(/[\/\\]/).pop() : undefined;
		});

		return data;
	};

	$scope.processDatabaseQueries = function(data)
	{
		if (!(data instanceof Object)) {
			return [];
		}

		$.each(data, function(key, value) {
			value.model = value.model || '-';
			value.shortModel = value.model ? value.model.split('\\').pop() : '-';
			value.fullPath = value.file && value.line ? value.file.replace(/^\//, '') + ':' + value.line : undefined;
			value.shortPath = value.fullPath ? value.fullPath.split(/[\/\\]/).pop() : undefined;
		});

		return data;
	};

	$scope.processEmails = function(data)
	{
		var emails = [];

		if (!(data instanceof Object)) {
			return emails;
		}

		$.each(data, function(key, value)
		{
			if (!(value.data instanceof Object)) {
				return;
			}

			emails.push({
				'to':      value.data.to,
				'subject': value.data.subject,
				'headers': value.data.headers
			});
		});

		return emails;
	};

	$scope.processHeaders = function(data)
	{
		var headers = [];

		if (!(data instanceof Object)) {
			return headers;
		}

		$.each(data, function(key, value){
			key = key.split('-').map(function(value){
				return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
			}).join('-');

			$.each(value, function(i, value){
				headers.push({name: key, value: value});
			});
		});

		return headers;
	};

	$scope.processLog = function(data)
	{
		if (!(data instanceof Object)) {
			return [];
		}

		$.each(data, function(key, value) {
			value.time = new Date(value.time * 1000);
			value.context = value.context !== '[]' ? value.context : undefined;
			value.fullPath = value.file && value.line ? value.file.replace(/^\//, '') + ':' + value.line : undefined;
			value.shortPath = value.fullPath ? value.fullPath.split(/[\/\\]/).pop() : undefined;
		});

		return data;
	};

	$scope.processTimeline = function(data)
	{
		var j = 1;
		var timeline = [];

		$.each(data.timelineData, function(i, value){
			value.style = 'style' + j.toString();
			value.left = (value.start - data.time) * 1000 / data.responseDuration * 100;
			value.width = value.duration / data.responseDuration * 100;

			value.durationRounded = Math.round(value.duration);

			if (value.durationRounded === 0) {
				value.durationRounded = '< 1';
			}

			if (i == 'total') {
				timeline.unshift(value);
			} else {
				timeline.push(value);
			}

			if (++j > 4) j = 1;
		});

		return timeline;
	};

	$scope.processViews = function(data)
	{
		var views = [];

		if (!(data instanceof Object)) {
			return views;
		}

		$.each(data, function(key, value)
		{
			if (!(value.data instanceof Object)) {
				return;
			}

			views.push({
				'name': value.data.name,
				'data': value.data.data
			});
		});

		return views;
	};

	$scope.getErrorsCount = function(data)
	{
		var count = 0;

		$.each(data.log, function(index, record)
		{
			if (record.level == 'error') {
				count++;
			}
		});

		return count;
	};

	$scope.getWarningsCount = function(data)
	{
		var count = 0;

		$.each(data.log, function(index, record)
		{
			if (record.level == 'warning') {
				count++;
			}
		});

		return count;
	};

	$scope.formatTime = function(seconds)
	{
		var minutes = Math.floor(seconds / 60);
		var hours = Math.floor(minutes / 60);

		seconds = seconds % 60;
		minutes = minutes % 60;

		var time = [];

		if (hours) time.push(hours + 'h');
		if (minutes) time.push(minutes + 'min');
		if (seconds) time.push(seconds + 'sec');

		return time.join(' ');
	};

	angular.element(window).bind('resize', function() {
		$scope.$apply(function(){
			$scope.activeTimelineLegend = $scope.generateTimelineLegend();
		});
    });
});
