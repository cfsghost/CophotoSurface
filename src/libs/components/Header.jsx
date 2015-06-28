/** @jsx React.DOM */

var React = require('react');
var Bootstrap = require('react-bootstrap');
var Navbar = Bootstrap.Navbar;
var Nav = Bootstrap.Nav;
var NavItem = Bootstrap.NavItem;
var DropdownButton = Bootstrap.DropdownButton;
var MenuItem = Bootstrap.MenuItem;

var Header = React.createClass({
	render: function() {
		return (
			<Navbar>
				<Nav>
					<NavItem eventKey={1} href="#">PiStreet</NavItem>
					<NavItem eventKey={2} href="#">Link</NavItem>
					<DropdownButton eventKey={3} title="Dropdown">
						<MenuItem eventKey="1">Action</MenuItem>
						<MenuItem eventKey="2">Another action</MenuItem>
						<MenuItem eventKey="3">Something else here</MenuItem>
						<MenuItem divider />
						<MenuItem eventKey="4">Separated link</MenuItem>
					</DropdownButton>
				</Nav>
			</Navbar>
		);
	}
});

module.exports = Header;
