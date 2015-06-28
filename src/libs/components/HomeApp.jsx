/** @jsx React.DOM */

var React = require('react');
var Header = require('./Header.jsx');

var HomeApp = React.createClass({
	render: function() {
		return (
			<div>
				<Header />
			</div>
		);
	}
});

module.exports = HomeApp;
