Clockwork.directive('stackTrace', function ($parse) {
	return {
		restrict: 'E',
		transclude: false,
		scope: { trace: '=trace', shortPath: '=shortPath', fullPath: '=fullPath' },
		templateUrl: 'assets/partials/stack-trace.html',
		link: function (scope, element, attrs) {
		}
	}
})
