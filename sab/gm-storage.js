class GMStorage {
    constructor(key = 'gm-storage', limit = 18) {
        this.key = key;
        this.arrayIdGameStorage = localStorage.getItem(this.key) ? JSON.parse(localStorage.getItem(this.key)) : [];
        this.limit = limit;
    }


    save = () => {
        return localStorage.setItem(this.key, JSON.stringify(this.arrayIdGameStorage))
    }

    get = () => {
        return localStorage.getItem(this.key) || null;
    }

    addGame = (id_game) => {
        if (!this.checkGameExist(id_game)) {
            this.arrayIdGameStorage.push(id_game)
            this.arrayIdGameStorage = this.arrayIdGameStorage.slice(-this.limit);
            this.save();
        }
    }

    checkGameExist = (id_game) => {
        if (this.arrayIdGameStorage.includes(id_game)) return true;
        return false;
    }

    removeGame = (id_game) => {
        if (this.checkGameExist(id_game)) {
            const index = this.arrayIdGameStorage.findIndex(v => v === id_game);
            if (index !== -1) {
                this.arrayIdGameStorage.splice(index, 1);
                this.save(); // Don't forget to save after removal
                return true;
            }
        }
        return false;
    }



}
