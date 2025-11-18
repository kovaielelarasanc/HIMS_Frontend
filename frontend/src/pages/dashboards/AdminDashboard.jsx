import { useSearchParams } from 'react-router-dom'
import Departments from '../admin/Departments'
import Roles from '../admin/Roles'
import Permissions from '../admin/Permissions'
import Users from '../admin/Users'


export default function AdminDashboard() {
    const [q] = useSearchParams()
    const tab = q.get('tab')
    return (
        <div className="space-y-6">
            {!tab && <div className="card"><h2 className="text-xl font-semibold">Admin Dashboard</h2><p>Use the sidebar to manage modules.</p></div>}
            {tab === 'departments' && <Departments />}
            {tab === 'roles' && <Roles />}
            {tab === 'permissions' && <Permissions />}
            {tab === 'users' && <Users />}
        </div>
    )
}