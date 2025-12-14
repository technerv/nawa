import { Link } from 'react-router-dom'

export default function WelcomePage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
			<div className="container mx-auto px-4 py-16">
				<div className="max-w-6xl mx-auto">
					{/* Hero Section */}
					<div className="text-center mb-16">
						<div className="mb-6">
							<h1 className="text-6xl md:text-7xl font-extrabold leading-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-pulse">
								Neighbourhood Alert Watch
							</h1>
							<div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
						</div>
						<p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
							Stay informed, stay safe. Real-time crime alerts, neighborhood connections, and emergency assistance at your fingertips.
						</p>
						<div className="flex gap-4 flex-wrap justify-center mb-12">
							<Link
								to="/public/dashboard"
								className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 no-underline"
							>
								📊 Public Dashboard
							</Link>
							<Link
								to="/public/map"
								className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 no-underline"
							>
								🗺️ Public Map
							</Link>
							<Link
								to="/public/report"
								className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 no-underline"
							>
								🚨 Report Incident
							</Link>
						</div>
					</div>

					{/* Features Grid */}
					<div className="grid md:grid-cols-3 gap-8 mb-16">
						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-gray-100 transform hover:-translate-y-2">
							<div className="text-5xl mb-4">🗺️</div>
							<h3 className="text-2xl font-bold mb-3 text-gray-800">Real-time Map</h3>
							<p className="text-gray-600 leading-relaxed">
								Explore incidents by severity and location with our interactive map. See what's happening in your area with color-coded markers.
							</p>
						</div>
						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-gray-100 transform hover:-translate-y-2">
							<div className="text-5xl mb-4">👥</div>
							<h3 className="text-2xl font-bold mb-3 text-gray-800">Neighborhoods</h3>
							<p className="text-gray-600 leading-relaxed">
								Join local groups to receive targeted alerts. Connect with neighbors and stay informed about incidents in your community.
							</p>
						</div>
						<div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300 border border-gray-100 transform hover:-translate-y-2">
							<div className="text-5xl mb-4">🆘</div>
							<h3 className="text-2xl font-bold mb-3 text-gray-800">Emergency SOS</h3>
							<p className="text-gray-600 leading-relaxed">
								Send critical alerts with your location when needed. Quick access to emergency services and instant notifications.
							</p>
						</div>
					</div>

					{/* Additional Features */}
					<div className="bg-white rounded-2xl p-8 shadow-lg mb-12 border border-gray-100">
						<h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Key Features</h2>
						<div className="grid md:grid-cols-2 gap-6">
							<div className="flex items-start gap-4">
								<div className="text-3xl">📱</div>
								<div>
									<h4 className="font-bold text-lg mb-2 text-gray-800">Mobile-Friendly</h4>
									<p className="text-gray-600">Access from any device, anywhere, anytime.</p>
								</div>
							</div>
							<div className="flex items-start gap-4">
								<div className="text-3xl">🔔</div>
								<div>
									<h4 className="font-bold text-lg mb-2 text-gray-800">Instant Alerts</h4>
									<p className="text-gray-600">Get notified immediately about incidents in your area.</p>
								</div>
							</div>
							<div className="flex items-start gap-4">
								<div className="text-3xl">🔒</div>
								<div>
									<h4 className="font-bold text-lg mb-2 text-gray-800">Anonymous Reporting</h4>
									<p className="text-gray-600">Report incidents safely and anonymously.</p>
								</div>
							</div>
							<div className="flex items-start gap-4">
								<div className="text-3xl">📊</div>
								<div>
									<h4 className="font-bold text-lg mb-2 text-gray-800">Data Analytics</h4>
									<p className="text-gray-600">View comprehensive crime statistics and trends.</p>
								</div>
							</div>
						</div>
					</div>

					{/* Footer */}
					<div className="text-center pt-8 border-t border-gray-200">
						<div className="flex justify-between items-center flex-wrap gap-4 mb-4">
							<span className="text-gray-500">© {new Date().getFullYear()} NAWA - Neighbourhood Alert Watch</span>
							<Link 
								to="/login" 
								className="text-blue-600 hover:text-blue-800 font-medium no-underline transition-colors"
							>
								Admin Login →
							</Link>
						</div>
						<p className="text-sm text-gray-400">
							Keeping communities safe, one alert at a time.
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
