// CourtCheck App - Main Application
class CourtCheckApp {
    constructor() {
        this.currentUser = null;
        this.currentCourt = null;
        this.map = null;
        this.markers = [];
        this.courts = [];
        this.selectedCrowdLevel = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupGoogleMaps();
        await this.loadUserData();
        this.showPage('map');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.showPage(page);
            });
        });

        // Authentication
        document.getElementById('loginBtn').addEventListener('click', () => {
            this.handleGoogleLogin();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Map controls
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchCourts();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchCourts();
            }
        });

        document.getElementById('sportFilter').addEventListener('change', () => {
            this.filterCourts();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.filterCourts();
        });

        // Court detail
        document.getElementById('backToMap').addEventListener('click', () => {
            this.showPage('map');
        });

        document.getElementById('checkInBtn').addEventListener('click', () => {
            this.showCheckInModal();
        });

        document.getElementById('favoriteBtn').addEventListener('click', () => {
            this.toggleFavorite();
        });

        // Check-in modal
        document.getElementById('closeCheckInModal').addEventListener('click', () => {
            this.hideCheckInModal();
        });

        document.getElementById('checkInForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitCheckIn();
        });

        // Crowd level selection
        document.querySelectorAll('.crowd-level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectCrowdLevel(parseInt(e.currentTarget.dataset.level));
            });
        });

        // Analytics
        document.getElementById('analyticsCourtSelect').addEventListener('change', () => {
            this.loadAnalytics();
        });
    }

    setupGoogleMaps() {
        if (typeof google === 'undefined') {
            console.error('Google Maps API not loaded');
            return;
        }

        const defaultLocation = { lat: 37.7749, lng: -122.4194 };

        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 13,
            center: defaultLocation,
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                }
            ]
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.map.setCenter(userLocation);
                    this.loadNearbyCourts(userLocation.lat, userLocation.lng);
                },
                () => {
                    this.loadNearbyCourts(defaultLocation.lat, defaultLocation.lng);
                }
            );
        } else {
            this.loadNearbyCourts(defaultLocation.lat, defaultLocation.lng);
        }
    }

    async loadNearbyCourts(lat, lng, radius = 10) {
        try {
            this.showLoading();
            const response = await fetch('data/sample-courts.json', { cache: 'no-store' });
            const raw = await response.json();

            const statusToLevel = { available: 1, moderate: 3, busy: 5 };

            const localCheckins = this._getAllCheckins();

            const transformed = raw.map((c) => {
                const [open, close] = (c.hours || '').split(' - ');
                const courtCheckins = (localCheckins[c.id] || []).slice(-5);
                const lastUpdated = courtCheckins.length > 0 ? new Date(courtCheckins[courtCheckins.length - 1].createdAt) : new Date();
                const crowdLevel = courtCheckins.length > 0 ? courtCheckins[courtCheckins.length - 1].crowdLevel : (statusToLevel[c.status] || 1);
                const currentStatus = { crowdLevel, lastUpdated };
                const statusText = this.getStatusText(crowdLevel);
                const statusColor = this.getStatusColor(crowdLevel);

                return {
                    id: c.id,
                    name: c.name,
                    address: c.address,
                    location: { type: 'Point', coordinates: [c.coordinates.lng, c.coordinates.lat] },
                    sportType: c.sport_type,
                    amenities: c.amenities || [],
                    operatingHours: { open: open || '', close: close || '' },
                    images: c.images || [],
                    currentStatus,
                    statusText,
                    statusColor,
                    description: '',
                    recentCheckIns: courtCheckins
                };
            });

            // compute distances and sort
            transformed.forEach((court) => {
                court._distanceKm = this.calculateDistance(lat, lng, court.location.coordinates[1], court.location.coordinates[0]);
            });
            transformed.sort((a, b) => a._distanceKm - b._distanceKm);

            this.courts = transformed;
            this.updateMapMarkers();
            this.updateCourtList();
        } catch (error) {
            console.error('Error loading courts:', error);
            this.showToast('Error loading courts', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateMapMarkers() {
        // Clear existing markers
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];

        this.courts.forEach(court => {
            const marker = new google.maps.Marker({
                position: { lat: court.location.coordinates[1], lng: court.location.coordinates[0] },
                map: this.map,
                title: court.name,
                icon: this.getMarkerIcon(court.currentStatus.crowdLevel)
            });

            marker.addListener('click', () => {
                this.showCourtDetail(court);
            });

            this.markers.push(marker);
        });
    }

    getMarkerIcon(crowdLevel) {
        const colors = {
            1: '#10b981', // green
            2: '#84cc16', // light green
            3: '#f59e0b', // yellow
            4: '#f97316', // orange
            5: '#ef4444'  // red
        };

        return {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: colors[crowdLevel] || colors[1],
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8
        };
    }

    updateCourtList() {
        const courtList = document.getElementById('courtList');
        courtList.innerHTML = '';

        this.courts.forEach(court => {
            const courtCard = this.createCourtCard(court);
            courtList.appendChild(courtCard);
        });
    }

    createCourtCard(court) {
        const card = document.createElement('div');
        card.className = 'court-card';
        card.addEventListener('click', () => this.showCourtDetail(court));

        const distance = this.calculateDistance(
            this.map.getCenter().lat(),
            this.map.getCenter().lng(),
            court.location.coordinates[1],
            court.location.coordinates[0]
        );

        card.innerHTML = `
            <div class="court-card-header">
                <div>
                    <div class="court-card-name">${court.name}</div>
                    <div class="court-card-sport">${court.sportType}</div>
                </div>
                <div class="court-card-distance">${distance.toFixed(1)} km</div>
            </div>
            <div class="court-card-status">
                <div class="status-indicator ${court.statusColor}"></div>
                <span>${court.statusText}</span>
            </div>
        `;

        return card;
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    showCourtDetail(court) {
        this.currentCourt = court;
        this.showPage('courtDetail');
        this.updateCourtDetailView();
    }

    updateCourtDetailView() {
        if (!this.currentCourt) return;

        document.getElementById('courtDetailName').textContent = this.currentCourt.name;
        document.getElementById('courtDescription').textContent = this.currentCourt.description || 'No description available';
        
        const statusIndicator = document.getElementById('courtStatusIndicator');
        statusIndicator.className = `status-indicator ${this.currentCourt.statusColor}`;
        
        document.getElementById('courtStatusText').textContent = this.currentCourt.statusText;
        document.getElementById('courtLastUpdated').textContent = 
            `Updated ${this.formatTimeAgo(new Date(this.currentCourt.currentStatus.lastUpdated))}`;

        // Update amenities
        const amenitiesContainer = document.getElementById('courtAmenities');
        if (this.currentCourt.amenities && this.currentCourt.amenities.length > 0) {
            amenitiesContainer.innerHTML = this.currentCourt.amenities
                .map(amenity => `<span class="amenity-tag">${amenity.replace('_', ' ')}</span>`)
                .join('');
        } else {
            amenitiesContainer.innerHTML = '<span class="amenity-tag">No amenities listed</span>';
        }

        // Update operating hours
        const hoursContainer = document.getElementById('courtHours');
        if (this.currentCourt.operatingHours) {
            const hours = this.currentCourt.operatingHours;
            hoursContainer.textContent = `${hours.open} - ${hours.close}`;
        } else {
            hoursContainer.textContent = 'Hours not specified';
        }

        // Update media gallery
        this.updateMediaGallery();
        
        // Load recent check-ins
        this.loadRecentCheckIns();

        // Update favorite button state
        const favorites = this._getFavorites();
        const btn = document.getElementById('favoriteBtn');
        if (btn) {
            if (favorites.includes(this.currentCourt.id)) {
                btn.innerHTML = '<i class="fas fa-heart"></i> Remove from Favorites';
            } else {
                btn.innerHTML = '<i class="far fa-heart"></i> Add to Favorites';
            }
        }
    }

    updateMediaGallery() {
        const mediaContainer = document.getElementById('courtMedia');
        if (this.currentCourt.images && this.currentCourt.images.length > 0) {
            mediaContainer.innerHTML = this.currentCourt.images
                .map(image => `
                    <div class="media-item">
                        <img src="${image.url}" alt="${image.caption || 'Court image'}" loading="lazy">
                    </div>
                `)
                .join('');
        } else {
            mediaContainer.innerHTML = '<p>No photos available</p>';
        }
    }

    async loadRecentCheckIns() {
        if (!this.currentCourt) return;
        const all = this._getAllCheckins();
        const list = (all[this.currentCourt.id] || []).slice(-5).reverse();
        this.updateRecentCheckIns(list.map(ci => ({
            user: { name: this.currentUser?.name || 'Anonymous', profilePicture: this.currentUser?.profilePicture },
            comment: ci.comment,
            createdAt: ci.createdAt
        })));
    }

    updateRecentCheckIns(checkIns) {
        const container = document.getElementById('recentCheckins');
        if (checkIns.length === 0) {
            container.innerHTML = '<p>No recent check-ins</p>';
            return;
        }

        container.innerHTML = checkIns.map(checkIn => `
            <div class="checkin-item">
                <div class="checkin-header">
                    <div class="checkin-user">
                        <img src="${checkIn.user.profilePicture || '/default-avatar.png'}" 
                             alt="${checkIn.user.name}" class="checkin-avatar">
                        <span>${checkIn.user.name}</span>
                    </div>
                    <div class="checkin-time">${this.formatTimeAgo(new Date(checkIn.createdAt))}</div>
                </div>
                <div class="checkin-comment">${checkIn.comment || 'No comment'}</div>
            </div>
        `).join('');
    }

    showCheckInModal() {
        if (!this.currentUser) {
            this.showToast('Please sign in to check in', 'warning');
            return;
        }
        document.getElementById('checkInModal').classList.remove('hidden');
    }

    hideCheckInModal() {
        document.getElementById('checkInModal').classList.add('hidden');
        this.resetCheckInForm();
    }

    selectCrowdLevel(level) {
        this.selectedCrowdLevel = level;
        document.querySelectorAll('.crowd-level-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`[data-level="${level}"]`).classList.add('selected');
    }

    resetCheckInForm() {
        this.selectedCrowdLevel = null;
        document.getElementById('checkInForm').reset();
        document.querySelectorAll('.crowd-level-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    async submitCheckIn() {
        if (!this.selectedCrowdLevel) {
            this.showToast('Please select crowd level', 'warning');
            return;
        }

        try {
            this.showLoading();

            const newCheckin = {
                courtId: this.currentCourt.id,
                crowdLevel: this.selectedCrowdLevel,
                comment: document.getElementById('checkInComment').value,
                duration: parseInt(document.getElementById('checkInDuration').value || '0', 10),
                createdAt: new Date().toISOString(),
                user: this.currentUser ? { name: this.currentUser.name, profilePicture: this.currentUser.profilePicture } : { name: 'Anonymous' }
            };

            const all = this._getAllCheckins();
            if (!all[this.currentCourt.id]) all[this.currentCourt.id] = [];
            all[this.currentCourt.id].push(newCheckin);
            localStorage.setItem('cc_checkins', JSON.stringify(all));

            // Update in-memory status
            this.currentCourt.currentStatus = { crowdLevel: newCheckin.crowdLevel, lastUpdated: new Date(newCheckin.createdAt) };
            this.currentCourt.statusText = this.getStatusText(newCheckin.crowdLevel);
            this.currentCourt.statusColor = this.getStatusColor(newCheckin.crowdLevel);

            this.showToast('Check-in submitted successfully!', 'success');
            this.hideCheckInModal();
            this.updateCourtDetailView();
            this.updateMapMarkers();
            this.updateCourtList();
        } catch (error) {
            console.error('Error submitting check-in:', error);
            this.showToast('Error submitting check-in', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async toggleFavorite() {
        if (!this.currentUser) {
            this.showToast('Please sign in to add favorites', 'warning');
            return;
        }

        const favorites = this._getFavorites();
        const id = this.currentCourt.id;
        const idx = favorites.indexOf(id);
        let isFavorite = false;
        if (idx === -1) {
            favorites.push(id);
            isFavorite = true;
        } else {
            favorites.splice(idx, 1);
            isFavorite = false;
        }
        localStorage.setItem('cc_favorites', JSON.stringify(favorites));

        const btn = document.getElementById('favoriteBtn');
        if (btn) {
            if (isFavorite) {
                btn.innerHTML = '<i class="fas fa-heart"></i> Remove from Favorites';
                this.showToast('Added to favorites!', 'success');
            } else {
                btn.innerHTML = '<i class="far fa-heart"></i> Add to Favorites';
                this.showToast('Removed from favorites', 'success');
            }
        }
    }

    async searchCourts() {
        const query = document.getElementById('searchInput').value.trim().toLowerCase();
        if (!query) return;

        const filtered = this.courts.filter(c => c.name.toLowerCase().includes(query) || (c.address || '').toLowerCase().includes(query));
        if (filtered.length > 0) {
            this.courts = filtered;
            this.updateMapMarkers();
            this.updateCourtList();
            const first = filtered[0];
            this.map.setCenter({ lat: first.location.coordinates[1], lng: first.location.coordinates[0] });
        } else {
            this.showToast('No courts found for your search', 'warning');
        }
    }

    filterCourts() {
        const sportFilter = document.getElementById('sportFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        let filteredCourts = this.courts;

        if (sportFilter) {
            filteredCourts = filteredCourts.filter(court => court.sportType === sportFilter);
        }

        if (statusFilter) {
            const statuses = statusFilter.split(',').map(s => parseInt(s));
            filteredCourts = filteredCourts.filter(court => 
                statuses.includes(court.currentStatus.crowdLevel)
            );
        }

        // Update map markers
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];

        filteredCourts.forEach(court => {
            const marker = new google.maps.Marker({
                position: { lat: court.location.coordinates[1], lng: court.location.coordinates[0] },
                map: this.map,
                title: court.name,
                icon: this.getMarkerIcon(court.currentStatus.crowdLevel)
            });

            marker.addListener('click', () => {
                this.showCourtDetail(court);
            });

            this.markers.push(marker);
        });

        // Update court list
        const courtList = document.getElementById('courtList');
        courtList.innerHTML = '';
        filteredCourts.forEach(court => {
            const courtCard = this.createCourtCard(court);
            courtList.appendChild(courtCard);
        });
    }

    showPage(pageName) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        document.getElementById(`${pageName}View`).classList.add('active');

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        // Load page-specific data
        if (pageName === 'profile') {
            this.loadProfileData();
        } else if (pageName === 'analytics') {
            this.loadAnalyticsData();
        }
    }

    async loadProfileData() {
        if (!this.currentUser) {
            document.getElementById('profileView').innerHTML = 
                '<div class="text-center"><p>Please sign in to view your profile</p></div>';
            return;
        }
        const user = this.currentUser;
        user.totalCheckIns = Object.values(this._getAllCheckins()).reduce((acc, arr) => acc + arr.length, 0);
        user.reputationScore = user.totalCheckIns * 5;
        user.badges = [];
        this.updateProfileView(user);
    }

    updateProfileView(user) {
        document.getElementById('profileName').textContent = user.name;
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('profileAvatar').src = user.profilePicture || '/default-avatar.png';
        document.getElementById('profileCheckIns').textContent = user.totalCheckIns;
        document.getElementById('profileReputation').textContent = user.reputationScore;
        document.getElementById('profileBadges').textContent = user.badges.length;

        // Load user's check-ins
        this.loadUserCheckIns();
        
        // Load favorite courts
        this.loadFavoriteCourts(user.favoriteCourts);
    }

    async loadUserCheckIns() {
        const all = this._getAllCheckins();
        const list = [];
        Object.keys(all).forEach(courtId => {
            all[courtId].forEach(ci => {
                list.push({
                    court: { name: this.courts.find(c => c.id === Number(courtId))?.name || `Court ${courtId}` },
                    createdAt: ci.createdAt,
                    crowdLevel: ci.crowdLevel,
                    comment: ci.comment
                });
            });
        });
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.updateUserCheckIns(list.slice(0, 10));
    }

    updateUserCheckIns(checkIns) {
        const container = document.getElementById('profileCheckins');
        if (checkIns.length === 0) {
            container.innerHTML = '<p>No check-ins yet</p>';
            return;
        }

        container.innerHTML = checkIns.map(checkIn => `
            <div class="checkin-item">
                <div class="checkin-header">
                    <div class="court-card-name">${checkIn.court.name}</div>
                    <div class="checkin-time">${this.formatTimeAgo(new Date(checkIn.createdAt))}</div>
                </div>
                <div class="court-card-status">
                    <div class="status-indicator ${this.getStatusColor(checkIn.crowdLevel)}"></div>
                    <span>Level ${checkIn.crowdLevel}</span>
                </div>
                ${checkIn.comment ? `<div class="checkin-comment">${checkIn.comment}</div>` : ''}
            </div>
        `).join('');
    }

    async loadFavoriteCourts() {
        const container = document.getElementById('profileFavorites');
        const favorites = this._getFavorites();
        if (favorites.length === 0) {
            container.innerHTML = '<p>No favorite courts yet</p>';
            return;
        }
        const items = favorites
            .map(id => this.courts.find(c => c.id === id))
            .filter(Boolean)
            .map(court => `
                <div class="court-card" onclick="app.showCourtDetail(${JSON.stringify(court).replace(/"/g, '&quot;')})">
                    <div class="court-card-header">
                        <div>
                            <div class="court-card-name">${court.name}</div>
                            <div class="court-card-sport">${court.sportType}</div>
                        </div>
                    </div>
                    <div class="court-card-status">
                        <div class="status-indicator ${this.getStatusColor(court.currentStatus.crowdLevel)}"></div>
                        <span>${this.getStatusText(court.currentStatus.crowdLevel)}</span>
                    </div>
                </div>
            `)
            .join('');
        container.innerHTML = items;
    }

    async loadAnalyticsData() {
        // Load courts for dropdown
        const select = document.getElementById('analyticsCourtSelect');
        select.innerHTML = '<option value="">Select a court...</option>';
        this.courts.forEach(court => {
            const option = document.createElement('option');
            option.value = court.id;
            option.textContent = court.name;
            select.appendChild(option);
        });
    }

    async loadAnalytics() {
        const courtId = document.getElementById('analyticsCourtSelect').value;
        if (!courtId) return;

        // Build simple analytics from local check-ins
        const all = this._getAllCheckins();
        const list = (all[courtId] || []).slice(-200);
        const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, averageCrowdLevel: 0, count: 0 }));
        const distribution = [1,2,3,4,5].map(l => ({ _id: l, count: 0 }));
        list.forEach(ci => {
            const d = new Date(ci.createdAt);
            const h = d.getHours();
            hourly[h].count += 1;
            hourly[h].averageCrowdLevel += ci.crowdLevel;
            const idx = distribution.findIndex(x => x._id === ci.crowdLevel);
            if (idx >= 0) distribution[idx].count += 1;
        });
        hourly.forEach(h => { if (h.count) h.averageCrowdLevel = +(h.averageCrowdLevel / h.count).toFixed(2); });
        const summary = {
            totalCheckIns: list.length,
            averageCrowdLevel: list.length ? +(list.reduce((a, c) => a + c.crowdLevel, 0) / list.length).toFixed(2) : 0,
            peakHour: hourly.reduce((max, cur, idx) => cur.count > hourly[max].count ? idx : max, 0)
        };
        this.updateAnalyticsCharts({ hourlyPatterns: hourly, crowdDistribution: distribution, summary });
    }

    updateAnalyticsCharts(analytics) {
        // Update busy hours chart
        this.updateBusyHoursChart(analytics.hourlyPatterns);
        
        // Update crowd distribution chart
        this.updateCrowdDistributionChart(analytics.crowdDistribution);
        
        // Update summary
        this.updateAnalyticsSummary(analytics.summary);
    }

    updateBusyHoursChart(hourlyData) {
        const ctx = document.getElementById('busyHoursChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.busyHoursChart) {
            this.busyHoursChart.destroy();
        }

        const hours = Array.from({length: 24}, (_, i) => i);
        const data = hours.map(hour => {
            const found = hourlyData.find(item => item.hour === hour);
            return found ? found.averageCrowdLevel : 0;
        });

        this.busyHoursChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [{
                    label: 'Average Crowd Level',
                    data: data,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5
                    }
                }
            }
        });
    }

    updateCrowdDistributionChart(distributionData) {
        const ctx = document.getElementById('crowdDistributionChart').getContext('2d');
        
        if (this.crowdDistributionChart) {
            this.crowdDistributionChart.destroy();
        }

        const labels = ['Empty', 'Light', 'Moderate', 'Busy', 'Very Busy'];
        const data = [1, 2, 3, 4, 5].map(level => {
            const found = distributionData.find(item => item._id === level);
            return found ? found.count : 0;
        });

        this.crowdDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#10b981',
                        '#84cc16',
                        '#f59e0b',
                        '#f97316',
                        '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    updateAnalyticsSummary(summary) {
        const container = document.getElementById('analyticsSummary');
        container.innerHTML = `
            <div class="summary-card">
                <div class="summary-card-value">${summary.totalCheckIns}</div>
                <div class="summary-card-label">Total Check-ins</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-value">${summary.averageCrowdLevel}</div>
                <div class="summary-card-label">Avg Crowd Level</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-value">${summary.peakHour || 'N/A'}:00</div>
                <div class="summary-card-label">Peak Hour</div>
            </div>
        `;
    }

    async handleGoogleLogin() {
        // Simple mock auth (Option A)
        const username = prompt('Enter username:');
        if (!username) return;
        const user = {
            id: `user-${Date.now()}`,
            name: username,
            email: `${username}@example.com`,
            profilePicture: 'https://via.placeholder.com/150',
            checkins: 0,
            reputation: 0
        };
        localStorage.setItem('cc_user', JSON.stringify(user));
        this.currentUser = user;
        this.updateAuthUI();
        this.showToast('Signed in successfully!', 'success');
    }

    logout() {
        localStorage.removeItem('cc_user');
        this.currentUser = null;
        this.updateAuthUI();
        this.showToast('Signed out successfully', 'success');
    }

    async loadUserData() {
        const userRaw = localStorage.getItem('cc_user');
        if (!userRaw) return;
        try {
            this.currentUser = JSON.parse(userRaw);
            this.updateAuthUI();
        } catch (e) {
            localStorage.removeItem('cc_user');
        }
    }

    updateAuthUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userMenu = document.getElementById('userMenu');
        
        if (this.currentUser) {
            loginBtn.classList.add('hidden');
            userMenu.classList.remove('hidden');
            document.getElementById('userName').textContent = this.currentUser.name;
            document.getElementById('userAvatar').src = this.currentUser.profilePicture || '/default-avatar.png';
        } else {
            loginBtn.classList.remove('hidden');
            userMenu.classList.add('hidden');
        }
    }

    // Local storage helpers
    _getAllCheckins() {
        try { return JSON.parse(localStorage.getItem('cc_checkins') || '{}'); } catch { return {}; }
    }

    _getFavorites() {
        try { return JSON.parse(localStorage.getItem('cc_favorites') || '[]'); } catch { return []; }
    }

    getStatusColor(crowdLevel) {
        const colors = {
            1: 'green',
            2: 'green',
            3: 'yellow',
            4: 'red',
            5: 'red'
        };
        return colors[crowdLevel] || 'green';
    }

    getStatusText(crowdLevel) {
        const texts = {
            1: 'Empty',
            2: 'Light',
            3: 'Moderate',
            4: 'Busy',
            5: 'Very Busy'
        };
        return texts[crowdLevel] || 'Unknown';
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Google Maps callback will initialize the app
window.initMap = () => {
    if (!window.app) {
        window.app = new CourtCheckApp();
    }
};

