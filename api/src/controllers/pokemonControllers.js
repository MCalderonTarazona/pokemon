const axios = require("axios");
const { Pokemon, Type } = require("../db");


let pokemonsCache = null;

const findPokemonsDB = async () => {
    try {
      const pokemons = await Pokemon.findAll({
        attributes: ['id', 'name', 'image', 'hp', 'attack', 'defense', 'speed', 'height', 'weight'],
        include: [
          {
            model: Type,
            attributes: ['name'],
            through: { attributes: [] },
          },
        ],
      });
      
    return pokemons.map(element => {
        const { Types, ...allAttributes } = element.get();
        const typeNames = Types.map(type => type.name);
        return { ...allAttributes, types: typeNames };
    });
      
    } catch (error) {
      return [];
    }
};

const  findPokemonsApi = async () => {
    if (pokemonsCache) {
        return pokemonsCache;
    }

    let pokemonsApi = [];
    let nextUrl = 'https://pokeapi.co/api/v2/pokemon?limit=100';

    while(nextUrl){
        try {
            const { data } = await axios.get(nextUrl);
            const { results, next } = data;

            // [{name,url},{name,url},...]
            const pokemonData = await Promise.all(results.map(async (element) => {
                try {
                    const pokemonUrl = await axios.get(element.url);
                    return pokemonUrl.data;
                } catch (error) {
                    console.log("Problemas al obtener detalles del pokemon");
                    return false
                }
            }));

            for (const element of pokemonData) {
                const { id, name, height, weight, sprites, stats, types } = element;
                const typeNames = types.map((type) => type.type.name);

                const pokemonDetails = {
                id,
                name,
                image: sprites.other.dream_world.front_default,
                hp: stats[0].base_stat,
                attack: stats[1].base_stat,
                defense: stats[2].base_stat,
                speed: stats[5].base_stat,
                height,
                weight,
                types: typeNames,
                };

                pokemonsApi.push(pokemonDetails);
            }
            nextUrl = next;  

        } catch (error) {
            console.log("Problemas al obtener detalles del pokemon");
            nextUrl = null; 
        }
    }
    pokemonsCache = pokemonsApi;
    console.log("Pokemons cargados con exito");
    return pokemonsApi;

}

const getAllPokemons = async (req, res) => {
  const pokemonsBD = await findPokemonsDB();
  const pokemonsApi = await findPokemonsApi();

  const allPokemons = [...pokemonsBD, ...pokemonsApi];  
  res.status(200).json(allPokemons)
};

const createPokemon = async (req, res) => {
    try {
        const { id, name, image, hp, attack, defense, speed, height, weight, types } = req.body;
        if( !name || !image || !hp || !attack || !defense || !types){
            return res.status(404).send('Faltan datos para el registro de tu pokemon');
        }
        const [newPokemon, created] = await Pokemon.findOrCreate({
            where: { name },
            defaults: { 
                id,
                name,
                image,
                hp,
                attack,
                defense,
                speed,
                height,
                weight
            }
        });

        if (!created){ res.status(404).send('El Pokemon ya existe');
        }else{
            for (const element of types) {
                const idType = await Type.findOne({ where: { name: element } });
                await newPokemon.addType(idType);
            }
            res.status(200).send('El Pokemon se ha creado con exito');  
        }
        
    } catch (error) {
        res.status(500).send(error.message);
    }
    
}

module.exports = {
    createPokemon,
    findPokemonsApi,
    getAllPokemons
};